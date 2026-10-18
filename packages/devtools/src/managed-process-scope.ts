import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  resolveDevtoolsHelperArgs,
  resolveDevtoolsHelperScript,
} from "./helper-scripts.js";
import {
  processGuardResponseSchema,
  processScopeAdmissionSchema,
  type ProcessGuardRequest,
  type ProcessGuardResponse,
} from "./process-scope-protocol.js";
import {
  closeProcessScope,
  processScopeJournalSchema,
  processScopeMarker,
} from "./process-scope.js";

let processScopeFault: Error | undefined;
function recordProcessScopeFault(error: unknown) {
  processScopeFault ??=
    error instanceof Error ? error : new Error(String(error));
}
export function assertProcessScopesConfirmed() {
  if (processScopeFault) throw processScopeFault;
}

class ProcessGuard {
  private readonly child: ChildProcess;
  private failure: Error | null = null;
  private readonly failureListeners = new Set<() => void>();
  get processId() {
    return this.child.pid;
  }
  watchFailure(listener: () => void) {
    if (this.failure) listener();
    else this.failureListeners.add(listener);
    return () => this.failureListeners.delete(listener);
  }
  private readonly pending = new Map<
    string,
    {
      resolve: (
        value: Extract<ProcessGuardResponse, { kind: "result" }>,
      ) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
      expired: boolean;
    }
  >();
  readonly ready: Promise<void>;
  constructor() {
    this.child = spawn(
      process.execPath,
      resolveDevtoolsHelperArgs(
        resolveDevtoolsHelperScript("process-scope-guard.ts"),
      ),
      {
        detached: true,
        stdio: ["ignore", "ignore", "inherit", "ipc"],
        env: Object.fromEntries(
          [
            "PATH",
            "SystemRoot",
            "WINDIR",
            "HOME",
            "TMPDIR",
            "TEMP",
            "TMP",
            "LANG",
            "LC_ALL",
            "NODE_DEBUG",
          ].flatMap((key) =>
            process.env[key] === undefined ? [] : [[key, process.env[key]]],
          ),
        ),
      },
    );
    this.child.unref();
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error(
          "process_scope_unavailable: Guardian startup timed out.",
        );
        reject(error);
        this.fail(error);
      }, 10000);
      this.child.on("message", (value: unknown) => {
        const message = processGuardResponseSchema.safeParse(value);
        if (!message.success)
          return this.fail(
            new Error("process_scope_unavailable: Invalid guardian response."),
          );
        const result = message.data;
        if (result.kind === "ready") {
          clearTimeout(timer);
          this.child.channel?.unref();
          resolve();
          return;
        }
        const request = this.pending.get(result.id);
        if (!request)
          return this.fail(
            new Error("process_scope_unavailable: Unknown guardian response."),
          );
        this.pending.delete(result.id);
        clearTimeout(request.timer);
        if (!request.expired) {
          if (result.kind === "error") {
            const error = new Error(result.message);
            if (result.scopeUnconfirmed) recordProcessScopeFault(error);
            request.reject(error);
          } else request.resolve(result);
        }
        if (![...this.pending.values()].some((value) => !value.expired))
          this.child.channel?.unref();
      });
      this.child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
        this.fail(error);
      });
      this.child.once("exit", () => {
        const error = new Error("process_scope_unavailable: Guardian exited.");
        clearTimeout(timer);
        reject(error);
        this.fail(error);
      });
    });
  }
  private fail(error: Error) {
    recordProcessScopeFault(error);
    const first = this.failure === null;
    this.failure ??= error;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
    if (this.child.connected) this.child.disconnect();
    this.child.channel?.unref();
    if (first) for (const listener of this.failureListeners) listener();
  }
  async request(request: ProcessGuardRequest) {
    await this.ready;
    if (this.failure) throw this.failure;
    if (this.pending.size >= 128)
      throw new Error(
        "process_scope_unavailable: Guardian request backlog exceeded.",
      );
    return new Promise<Extract<ProcessGuardResponse, { kind: "result" }>>(
      (resolve, reject) => {
        this.child.channel?.ref();
        const timer = setTimeout(() => {
          const pending = this.pending.get(request.id);
          if (!pending) return;
          pending.expired = true;
          const error = new Error(
            "process_scope_unavailable: Guardian request timed out.",
          );
          recordProcessScopeFault(error);
          reject(error);
          if (![...this.pending.values()].some((value) => !value.expired))
            this.child.channel?.unref();
        }, 10000);
        this.pending.set(request.id, {
          resolve,
          reject,
          timer,
          expired: false,
        });
        this.child.send(request, (error) => {
          if (error) this.fail(error);
        });
      },
    );
  }
}
let guard: ProcessGuard | undefined;
const processScopes = new WeakMap<ChildProcess, () => Promise<void>>();

async function stopUnadmittedRoot(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null)
    return;
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      child.off("exit", exited);
      child.off("error", failed);
      if (error) reject(error);
      else resolve();
    };
    const exited = () => finish();
    const failed = (error: Error) => finish(error);
    const timer = setTimeout(
      () =>
        finish(
          new Error("process_tree_unconfirmed: Unadmitted root did not exit."),
        ),
      2000,
    );
    child.once("exit", exited);
    child.once("error", failed);
    child.kill("SIGKILL");
  });
}

export type ProcessScopeObserver = (close: () => Promise<void>) => void;

export async function closeAfterProcessFailure(
  close: () => Promise<void>,
  primary: unknown,
): Promise<never> {
  try {
    await close();
  } catch (cleanup) {
    if (primary === cleanup) throw primary;
    const message = (value: unknown) =>
      value instanceof Error ? value.message : String(value);
    throw new AggregateError(
      [primary, cleanup],
      `${message(primary)}; process cleanup could not be confirmed: ${message(cleanup)}`,
    );
  }
  throw primary;
}

/** The bootstrap's gate opens only after kernel membership is recorded, before loading tsx or user code. */
export async function spawnScopedProcess(
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    onScope?: ProcessScopeObserver;
  },
) {
  assertProcessScopesConfirmed();
  const registerTypescript = args[0] === "--import";
  const entry = registerTypescript ? args[2] : args[0];
  if (!entry || entry.startsWith("-"))
    throw new Error("A scoped process requires a helper module.");
  const argumentsList = args.slice(registerTypescript ? 3 : 1);
  const manager = (guard ??= new ProcessGuard());
  const token = randomUUID();
  await manager.request({
    kind: "open",
    id: randomUUID(),
    token,
    rootDir: options.cwd,
  });
  const { onScope, ...processOptions } = options;
  const child = spawn(
    process.execPath,
    [
      resolveDevtoolsHelperScript("process-scope-bootstrap.mjs"),
      entry,
      registerTypescript ? args[1] : "javascript",
      ...argumentsList,
      processScopeMarker(token),
    ],
    {
      ...processOptions,
      env: { ...(options.env ?? process.env), AIRJAM_PROCESS_SCOPE: token },
      detached: true,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  let admitted = false;
  let hello = false;
  let gateOpened = false;
  const openGate = () => {
    if (hello && admitted && !gateOpened && !closing && child.connected) {
      gateOpened = true;
      child.send(1);
    }
  };
  let closing: Promise<void> | undefined;
  let unwatch = () => {};
  const close = () =>
    (closing ??= (async () => {
      const result = await manager.request({
        kind: "close",
        id: randomUUID(),
        token,
      });
      if (!admitted) await stopUnadmittedRoot(child);
      if (result.receipt?.status !== "tree_clean")
        throw new Error(
          `process_tree_unconfirmed: ${JSON.stringify(result.receipt)}`,
        );
      unwatch();
    })().catch((error) => {
      recordProcessScopeFault(error);
      throw error;
    }));
  unwatch = manager.watchFailure(() => {
    void (async () => {
      if (process.platform === "win32") {
        await stopUnadmittedRoot(child);
        return;
      }
      const filename = path.join(
        options.cwd,
        ".airjam/devtools/process-scopes",
        `${token}.json`,
      );
      const journal = processScopeJournalSchema.parse(
        JSON.parse(await readFile(filename, "utf8")),
      );
      if (
        journal.scope.token !== token ||
        journal.guardian.processId !== manager.processId
      )
        throw new Error(
          "process_tree_unconfirmed: Guardian recovery identity mismatch.",
        );
      const receipt = await closeProcessScope(journal.scope);
      if (receipt.status !== "tree_clean")
        throw new Error(`process_tree_unconfirmed: ${JSON.stringify(receipt)}`);
    })()
      .catch((error) => console.error(error))
      .finally(() => {
        child.kill("SIGKILL");
      });
  });
  processScopes.set(child, close);
  try {
    onScope?.(close);
  } catch (error) {
    return closeAfterProcessFailure(close, error);
  }
  child.on("message", (value: unknown) => {
    if (value === 0) {
      hello = true;
      openGate();
      return;
    }
    const request = processScopeAdmissionSchema.safeParse(value);
    if (!request.success) return;
    void (async () => {
      let error: string | undefined;
      try {
        if (!admitted || request.data.token !== token || closing)
          throw new Error(
            "process_scope_unavailable: Scope admission is closed.",
          );
        await manager.request({
          kind: "register",
          id: randomUUID(),
          token,
          processId: request.data.processId,
          root: false,
        });
      } catch (failure) {
        error = failure instanceof Error ? failure.message : String(failure);
      }
      if (child.connected)
        child.send({
          type: "airjam-process-scope/admitted",
          id: request.data.id,
          ...(error ? { error } : {}),
        });
    })().catch((error) => console.error(error));
  });
  child.once("exit", () => {
    void close().catch((error) => console.error(error));
  });
  child.once("error", () => {
    void close().catch((error) => console.error(error));
  });
  void (async () => {
    if (!child.pid) throw new Error("Process root identity unavailable.");
    await manager.request({
      kind: "register",
      id: randomUUID(),
      token,
      processId: child.pid,
      root: true,
    });
    if (closing) return;
    admitted = true;
    openGate();
  })().catch((error) => {
    console.error(error);
    void close().catch((failure) => console.error(failure));
  });
  return child;
}

export async function closeScopedProcess(child: ChildProcess | null) {
  if (!child) return;
  const close = processScopes.get(child);
  if (!close)
    throw new Error(
      "process_scope_unavailable: Process has no registered cleanup owner.",
    );
  await close();
}
