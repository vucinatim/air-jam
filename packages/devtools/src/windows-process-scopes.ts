import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { resolveDevtoolsHelperScript } from "./helper-scripts.js";
import {
  processGuardResponseSchema,
  type ProcessGuardResponse,
} from "./process-scope-protocol.js";
import { processScopeReceiptSchema } from "./process-scope.js";

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
    this.child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `& ([scriptblock]::Create([IO.File]::ReadAllText('${resolveDevtoolsHelperScript("process-scope-windows.ps1").replaceAll("'", "''")}')))`,
      ],
      { stdio: ["pipe", "pipe", "inherit"], windowsHide: true },
    );
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error(
          "process_scope_unavailable: Windows job guardian startup timed out.",
        );
        reject(error);
        this.fail(error);
        this.child.kill();
      }, 10000);
      const output = this.child.stdout;
      if (!output) throw new Error("Windows guardian output is unavailable.");
      const lines = createInterface({ input: output });
      lines.on("line", (line) => {
        try {
          const result = processGuardResponseSchema.parse(JSON.parse(line));
          if (result.kind === "ready") {
            clearTimeout(timer);
            resolve();
            return;
          }
          const request = this.pending.get(result.id);
          if (!request) throw new Error("Unknown Windows job acknowledgement.");
          this.pending.delete(result.id);
          clearTimeout(request.timer);
          if (result.kind === "error")
            request.reject(new Error(result.message));
          else request.resolve(result);
        } catch (error) {
          this.fail(error instanceof Error ? error : new Error(String(error)));
        }
      });
      this.child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
        this.fail(error);
      });
      this.child.once("exit", () => {
        clearTimeout(timer);
        const error = new Error(
          "process_scope_unavailable: Windows job guardian exited.",
        );
        reject(error);
        this.fail(error);
      });
    });
  }
  static async open() {
    const owner = new WindowsProcessScopes();
    await owner.ready;
    return owner;
  }
  private fail(error: Error) {
    this.failure ??= error;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
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
          this.child.kill();
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
