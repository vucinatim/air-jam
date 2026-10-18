import crossSpawn from "cross-spawn";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { z } from "zod";
import { dependencyInstallObservationSchema } from "./dependency-install-contract.js";

const eventSchema = z.object({
  name: z.string().optional(),
  packageId: z.string().optional(),
  status: z.string().optional(),
  stage: z.string().optional(),
  method: z.string().optional(),
  added: z.number().int().optional(),
  level: z.string().optional(),
});

export class DependencyInstallObservation {
  private packages = new Map<string, Set<string>>();
  private started = performance.now();
  private stages: z.infer<typeof dependencyInstallObservationSchema>["stages"] =
    [];
  private added = 0;
  private importMethods = new Set<string>();
  private errors = "";
  accept(line: string) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      this.errors = (this.errors + "\n" + line).slice(-16_384);
      return;
    }
    const parsed = eventSchema.safeParse(value);
    if (!parsed.success) return;
    const event = parsed.data;
    if (
      event.method &&
      (event.name === "pnpm:package-import-method" ||
        (event.name === "pnpm:progress" && event.status === "imported"))
    )
      this.importMethods.add(event.method);
    if (event.name === "pnpm:progress" && event.packageId && event.status) {
      const states = this.packages.get(event.packageId) ?? new Set<string>();
      states.add(event.status);
      this.packages.set(event.packageId, states);
    }
    if (
      event.name === "pnpm:stage" &&
      event.stage &&
      ["importing_started", "importing_done"].includes(event.stage)
    )
      this.stages.push({
        stage: event.stage,
        offsetMs: performance.now() - this.started,
      });
    if (
      event.name === "pnpm:stats" &&
      event.added !== undefined &&
      Number.isSafeInteger(event.added)
    )
      this.added = event.added;
    if (event.level === "error")
      this.errors = (this.errors + "\n" + line).slice(-16_384);
  }
  failure(exitCode: number | null, signal: NodeJS.Signals | null = null) {
    return new Error(
      `Dependency installation failed (exit=${exitCode}, signal=${signal}): ${JSON.stringify(this.finish())}${this.errors}`,
    );
  }
  finish() {
    const count = (status: string) =>
      [...this.packages.values()].filter((states) => states.has(status)).length;
    return dependencyInstallObservationSchema.parse({
      durationMs: performance.now() - this.started,
      packageCount: this.packages.size,
      reused: count("found_in_store"),
      downloaded: count("fetched"),
      added: this.added,
      stages: this.stages,
      importMethods: [...this.importMethods].sort(),
    });
  }
  assertIndependentImports() {
    if (this.added > 0 && this.importMethods.size === 0)
      throw new Error(
        "Dependency installation did not report its import method.",
      );
    if ([...this.importMethods].some((method) => method !== "copy"))
      throw new Error(
        `Dependency installation requires independent copies; pnpm reported ${[...this.importMethods].join(", ")}.`,
      );
  }
}

/** Workspace preparation, explicit upgrades and pinned tests share one installer. */
export async function installDependencies(
  directory: string,
  options: {
    signal?: AbortSignal;
    network?: "online" | "prefer-offline" | "offline";
    lockfile?: "frozen" | "update";
    scripts?: "run" | "ignore";
  } = {},
) {
  options.signal?.throwIfAborted();
  const observation = new DependencyInstallObservation();
  const child = crossSpawn(
    "pnpm",
    [
      "install",
      options.lockfile === "update"
        ? "--no-frozen-lockfile"
        : "--frozen-lockfile",
      "--reporter=ndjson",
      "--package-import-method=copy",
      ...(options.scripts === "ignore" ? ["--ignore-scripts"] : []),
      ...(options.network && options.network !== "online"
        ? [`--${options.network}`]
        : []),
    ],
    {
      cwd: directory,
      stdio: ["ignore", "pipe", "pipe"],
      signal: options.signal,
      killSignal: "SIGKILL",
    },
  );
  if (!child.stderr || !child.stdout)
    throw new Error("The dependency installer requires piped output.");
  const output = [child.stdout, child.stderr].map((input) =>
    createInterface({ input }),
  );
  const reading = Promise.all(
    output.map(async (reader) => {
      for await (const line of reader) observation.accept(line);
    }),
  );
  const finished = new Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (exitCode, signal) => resolve({ exitCode, signal }));
  });
  const closed = new Promise<void>((resolve) =>
    child.once("close", () => resolve()),
  );
  try {
    const [{ exitCode, signal }] = await Promise.all([finished, reading]);
    if (exitCode !== 0) throw observation.failure(exitCode, signal);
    observation.assertIndependentImports();
    return observation.finish();
  } catch (error) {
    child.kill("SIGKILL");
    await closed;
    const failure = options.signal?.aborted
      ? new Error(
          observation.failure(child.exitCode, child.signalCode).message,
          { cause: error },
        )
      : error;
    await rm(path.join(directory, "node_modules"), {
      recursive: true,
      force: true,
    });
    throw failure;
  } finally {
    for (const reader of output) reader.close();
  }
}
