import { closeSync, openSync, writeSync } from "node:fs";
import type { z } from "zod";
import {
  resolveDevtoolsHelperArgs,
  resolveDevtoolsHelperScript,
  resolveProjectDevtoolsHelperScript,
} from "./helper-scripts.js";
import {
  closeAfterProcessFailure,
  closeScopedProcess,
  spawnScopedProcess,
  type ProcessScopeObserver,
} from "./managed-process-scope.js";
import { processScopeAdmissionSchema } from "./process-scope-protocol.js";

const environmentKeys = [
  "PATH",
  "HOME",
  "TMPDIR",
  "TEMP",
  "TMP",
  "NODE_EXTRA_CA_CERTS",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
];

const LOG_BYTES = 1_000_000;
const STARTUP_MS = 10_000;

/**
 * One helper process that runs game code apart from the owner, answering one
 * request at a time over IPC. Its errors start with `<name>_`, such as
 * `policy_timeout`, so callers can tell them apart.
 */
export async function startHelperChannel<
  TRequest extends { id: string },
  TResponse extends { kind: string; id?: string },
>({
  name,
  helper,
  rootDir,
  toolingRootDir,
  onScope,
  startupSignal,
  logPath,
  maxBytes,
  requestSchema,
  responseSchema,
}: {
  name: string;
  helper: string;
  rootDir: string;
  toolingRootDir?: string;
  onScope?: ProcessScopeObserver;
  startupSignal?: AbortSignal;
  logPath: string;
  maxBytes: number;
  requestSchema: z.ZodType<TRequest>;
  responseSchema: z.ZodType<TResponse>;
}): Promise<{
  request: (input: TRequest, timeoutMs: number) => Promise<TResponse>;
  busy: () => boolean;
  /** Ends the startup signal's hold once the caller has initialized the helper. */
  started: () => void;
  stop: () => Promise<void>;
}> {
  startupSignal?.throwIfAborted();
  const script = toolingRootDir
    ? resolveProjectDevtoolsHelperScript(toolingRootDir, helper)
    : resolveDevtoolsHelperScript(helper);
  const logDescriptor = openSync(logPath, "w", 0o600);
  const child = await spawnScopedProcess(resolveDevtoolsHelperArgs(script), {
    cwd: rootDir,
    onScope,
    startupSignal,
    env: Object.fromEntries(
      environmentKeys.flatMap((key) =>
        process.env[key] === undefined ? [] : [[key, process.env[key]]],
      ),
    ),
  }).catch((error) => {
    closeSync(logDescriptor);
    if (startupSignal?.aborted)
      throw new Error(`${name}_stopped`, { cause: error });
    throw error;
  });
  let failure: Error | undefined;
  let ready = false;
  let pending:
    | {
        id: string;
        resolve: (value: TResponse) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
        expired: boolean;
      }
    | undefined;
  let stopping: Promise<void> | undefined;
  let resolveReady: () => void;
  let rejectReady: (error: Error) => void;
  const boot = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const fail = (error: Error) => {
    failure ??= error;
    rejectReady(error);
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      pending = undefined;
    }
  };
  child.on("error", fail);
  child.once("exit", () => {
    fail(new Error(`${name}_exited: The ${name} process is unavailable.`));
  });
  let logBytes = 0;
  const log = (chunk: Buffer) => {
    const remaining = LOG_BYTES - logBytes;
    if (remaining > 0) {
      const bounded = chunk.subarray(0, remaining);
      try {
        let offset = 0;
        while (offset < bounded.length)
          offset += writeSync(logDescriptor, bounded.subarray(offset));
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
        child.kill("SIGKILL");
      }
    }
    logBytes += chunk.length;
    if (logBytes > LOG_BYTES) {
      fail(
        new Error(
          `${name}_log_limit: The ${name} process exceeded its 1 MB diagnostic log budget.`,
        ),
      );
      child.kill("SIGKILL");
    }
  };
  child.stdout?.on("data", log);
  child.stderr?.on("data", log);
  child.on("message", (message: unknown) => {
    if (message === 0) return;
    if (processScopeAdmissionSchema.safeParse(message).success) return;
    try {
      if (Buffer.byteLength(JSON.stringify(message)) > maxBytes)
        throw new Error(`${name}_protocol: Oversized response.`);
      const result = responseSchema.parse(message);
      if (result.kind === "ready") {
        if (ready) throw new Error(`${name}_protocol: Duplicate startup.`);
        ready = true;
        resolveReady();
        return;
      }
      if (!pending || result.id !== pending.id)
        throw new Error(`${name}_protocol: Unexpected response ID.`);
      const request = pending;
      pending = undefined;
      clearTimeout(request.timer);
      if (!request.expired) request.resolve(result);
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
      child.kill("SIGKILL");
    }
  });
  const request = (input: TRequest, timeoutMs: number) => {
    if (failure) return Promise.reject(failure);
    if (pending)
      return Promise.reject(
        new Error(`${name}_busy: The previous request has not returned.`),
      );
    const parsed = requestSchema.parse(input);
    if (Buffer.byteLength(JSON.stringify(parsed)) > maxBytes)
      return Promise.reject(
        new Error(`${name}_protocol: Request exceeds its byte budget.`),
      );
    return new Promise<TResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending?.id !== parsed.id) return;
        pending.expired = true;
        reject(new Error(`${name}_timeout: Request exceeded its deadline.`));
      }, timeoutMs);
      pending = { id: parsed.id, resolve, reject, timer, expired: false };
      child.send(parsed, (error) => {
        if (error) fail(error);
      });
    });
  };
  const stop = () =>
    (stopping ??= (async () => {
      startupSignal?.removeEventListener("abort", aborted);
      fail(new Error(`${name}_stopped`));
      try {
        await closeScopedProcess(child);
      } finally {
        child.stdout?.destroy();
        child.stderr?.destroy();
        closeSync(logDescriptor);
      }
    })());
  const aborted = () => {
    void stop().catch(() => undefined);
  };
  startupSignal?.addEventListener("abort", aborted, { once: true });
  const bootTimeout = setTimeout(
    () => fail(new Error(`${name}_startup_timeout`)),
    STARTUP_MS,
  );
  try {
    if (startupSignal?.aborted) aborted();
    await boot;
  } catch (error) {
    startupSignal?.removeEventListener("abort", aborted);
    return closeAfterProcessFailure(stop, error);
  } finally {
    clearTimeout(bootTimeout);
  }
  return {
    request,
    busy: () => pending !== undefined,
    started: () => startupSignal?.removeEventListener("abort", aborted),
    stop,
  };
}
