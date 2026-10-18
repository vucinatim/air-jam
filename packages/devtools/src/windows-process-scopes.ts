import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { debuglog } from "node:util";
import { resolveDevtoolsHelperScript } from "./helper-scripts.js";
import {
  processGuardResponseSchema,
  processGuardStartupTimeoutMs,
  type ProcessGuardResponse,
} from "./process-scope-protocol.js";
import { processScopeReceiptSchema } from "./process-scope.js";

const debug = debuglog("airjam-process-scope");

/** Kernel job handles remain in this guardian; EOF or guardian death kills every member. */
export class WindowsProcessScopes {
  private readonly child: ChildProcess;
  private readonly pending = new Map<
    string,
    {
      resolve: (
        value: Extract<ProcessGuardResponse, { kind: "result" }>,
      ) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private failure: Error | null = null;
  private readonly ready: Promise<void>;
  private constructor() {
    const started = performance.now();
    let firstOutput = Buffer.alloc(0);
    let diagnosticTail = "";
    const failure = (message: string) =>
      new Error(
        `${message} Elapsed ${Math.round(performance.now() - started)} ms; stdout prefix ${firstOutput.toString("hex") || "none"}; diagnostics: ${diagnosticTail || "none"}`,
      );
    this.child = spawn(
      "pwsh.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `& ([scriptblock]::Create([IO.File]::ReadAllText('${resolveDevtoolsHelperScript("process-scope-windows.ps1").replaceAll("'", "''")}')))`,
      ],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    this.child.once("spawn", () =>
      debug(
        "PowerShell spawned in %d ms",
        Math.round(performance.now() - started),
      ),
    );
    this.child.stderr?.on("data", (chunk: Buffer) => {
      diagnosticTail = (diagnosticTail + chunk.toString()).slice(-4096);
      debug("%s", chunk.toString().trim());
    });
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = failure(
          "process_scope_unavailable: Windows job guardian startup timed out.",
        );
        abort(error);
      }, processGuardStartupTimeoutMs - 2500);
      const abort = (error: Error) => {
        clearTimeout(timer);
        reject(error);
        this.fail(error);
      };
      const output = this.child.stdout;
      if (!output) throw new Error("Windows guardian output is unavailable.");
      output.on("error", abort);
      this.child.stdin?.on("error", abort);
      this.child.stderr?.on("error", abort);
      output.on("data", (chunk: Buffer) => {
        if (firstOutput.length === 0)
          debug(
            "First PowerShell output at %d ms: %s",
            Math.round(performance.now() - started),
            chunk.subarray(0, 64).toString("hex"),
          );
        if (firstOutput.length < 64)
          firstOutput = Buffer.concat([
            firstOutput,
            chunk.subarray(0, 64 - firstOutput.length),
          ]);
      });
      const lines = createInterface({ input: output });
      lines.on("line", (line) => {
        try {
          const result = processGuardResponseSchema.parse(JSON.parse(line));
          if (result.kind === "ready") {
            clearTimeout(timer);
            resolve();
            return;
          }
          if (result.kind === "startup-error") throw new Error(result.message);
          const request = this.pending.get(result.id);
          if (!request) throw new Error("Unknown Windows job acknowledgement.");
          this.pending.delete(result.id);
          clearTimeout(request.timer);
          if (result.kind === "error")
            request.reject(new Error(result.message));
          else request.resolve(result);
        } catch (error) {
          const invalid = failure(
            `process_scope_unavailable: Invalid Windows guardian response ${JSON.stringify(line.slice(0, 256))}: ${error instanceof Error ? error.message : String(error)}`,
          );
          abort(invalid);
        }
      });
      this.child.once("error", (error) =>
        abort(
          failure(
            `process_scope_unavailable: Windows process scopes require PowerShell 7.4+ (pwsh). Install: winget install Microsoft.PowerShell. ${error.message}`,
          ),
        ),
      );
      this.child.once("exit", (code, signal) => {
        const error = failure(
          `process_scope_unavailable: Windows job guardian exited (code ${code}, signal ${signal}).`,
        );
        abort(error);
      });
    });
  }
  static async open() {
    const owner = new WindowsProcessScopes();
    await owner.ready;
    return owner;
  }
  private fail(error: Error) {
    const first = this.failure === null;
    this.failure ??= error;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
    if (first) this.child.kill();
  }
  private async request(input: Record<string, unknown>) {
    await this.ready;
    if (this.failure) throw this.failure;
    const id = randomUUID();
    return new Promise<Extract<ProcessGuardResponse, { kind: "result" }>>(
      (resolve, reject) => {
        const timer = setTimeout(() => {
          this.fail(
            new Error(
              "process_scope_unavailable: Windows job request timed out.",
            ),
          );
        }, 5000);
        this.pending.set(id, { resolve, reject, timer });
        this.child.stdin?.write(
          `${JSON.stringify({ ...input, id })}\n`,
          (error) => {
            if (error) this.fail(error);
          },
        );
      },
    );
  }
  async create(token: string) {
    await this.request({ kind: "open", token });
  }
  async register(token: string, processId: number, root: boolean) {
    await this.request({ kind: "register", token, processId, root });
  }
  async close(token: string) {
    const result = await this.request({ kind: "close", token });
    return processScopeReceiptSchema.parse(result.receipt);
  }
  async shutdown() {
    this.child.stdin?.end();
    await new Promise<void>((resolve) => {
      if (this.child.exitCode !== null) return resolve();
      const timer = setTimeout(() => {
        this.child.kill();
        resolve();
      }, 4000);
      this.child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}
