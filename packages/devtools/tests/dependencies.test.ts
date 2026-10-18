import crossSpawn from "cross-spawn";
import { ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it, vi } from "vitest";
import {
  DependencyInstallObservation,
  installDependencies,
} from "../src/dependencies.js";
vi.mock("cross-spawn", () => ({ default: vi.fn() }));

it("reports the actual install progress and termination signal without drowning the cause in optional-platform warnings", () => {
  const observation = new DependencyInstallObservation();
  observation.accept(
    JSON.stringify({
      name: "pnpm:progress",
      packageId: "one",
      status: "found_in_store",
    }),
  );
  observation.accept(
    JSON.stringify({
      name: "pnpm:progress",
      packageId: "two",
      status: "fetched",
    }),
  );
  observation.accept(
    JSON.stringify({ name: "pnpm:stage", stage: "importing_started" }),
  );
  observation.accept(
    JSON.stringify({
      name: "pnpm:install-check",
      level: "warn",
      message: "Unsupported optional platform",
    }),
  );
  observation.accept("The actual network failure");
  const error = observation.failure(null, "SIGTERM");
  expect(error.message).toContain("signal=SIGTERM");
  expect(error.message).toContain('"reused":1');
  expect(error.message).toContain('"downloaded":1');
  expect(error.message).toContain('"stage":"importing_started"');
  expect(error.message).toContain("The actual network failure");
  expect(error.message).not.toContain("Unsupported optional platform");
});

it("refuses pre-cancelled installation before spawning pnpm", async () => {
  const reason = new Error("The operation was cancelled before installation.");
  await expect(
    installDependencies("/not-used", { signal: AbortSignal.abort(reason) }),
  ).rejects.toBe(reason);
  expect(crossSpawn).not.toHaveBeenCalled();
});

it("records actual import methods and refuses shared dependency inodes", () => {
  const copied = new DependencyInstallObservation();
  copied.accept(
    JSON.stringify({ name: "pnpm:package-import-method", method: "copy" }),
  );
  expect(() => copied.assertIndependentImports()).not.toThrow();
  expect(copied.finish().importMethods).toEqual(["copy"]);
  const shared = new DependencyInstallObservation();
  shared.accept(
    JSON.stringify({
      name: "pnpm:progress",
      status: "imported",
      method: "hardlink",
    }),
  );
  expect(() => shared.assertIndependentImports()).toThrow(
    "pnpm reported hardlink",
  );
  expect(shared.finish().importMethods).toEqual(["hardlink"]);
  const unreported = new DependencyInstallObservation();
  unreported.accept(JSON.stringify({ name: "pnpm:stats", added: 1 }));
  expect(() => unreported.assertIndependentImports()).toThrow(
    "did not report its import method",
  );
});

it.each([
  {
    options: { network: "offline" as const },
    flags: [
      "--frozen-lockfile",
      "--reporter=ndjson",
      "--package-import-method=copy",
      "--offline",
    ],
  },
  {
    options: {
      network: "prefer-offline" as const,
      lockfile: "update" as const,
      scripts: "ignore" as const,
    },
    flags: [
      "--no-frozen-lockfile",
      "--reporter=ndjson",
      "--package-import-method=copy",
      "--ignore-scripts",
      "--prefer-offline",
    ],
  },
])(
  "pins copy imports for typed install options $options",
  async ({ options, flags }) => {
    const child = new ChildProcess();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    child.stdout = stdout;
    child.stderr = stderr;
    vi.mocked(crossSpawn).mockReturnValueOnce(child);
    const installation = installDependencies("/not-used", options);
    stdout.end(
      JSON.stringify({ name: "pnpm:package-import-method", method: "copy" }) +
        "\n",
    );
    stderr.end();
    child.emit("close", 0, null);
    expect((await installation).importMethods).toEqual(["copy"]);
    expect(crossSpawn).toHaveBeenLastCalledWith("pnpm", ["install", ...flags], {
      cwd: "/not-used",
      stdio: ["ignore", "pipe", "pipe"],
      signal: undefined,
      killSignal: "SIGKILL",
    });
  },
);

it("waits for a real aborted installer to close before removing its writable tree", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "airjam-install-abort-"));
  const script = path.join(directory, "installer.cjs");
  const marker = path.join(directory, "ready");
  await writeFile(
    script,
    `const fs=require('node:fs');const path=require('node:path');const root=process.argv[2];process.on('SIGTERM',()=>{});setInterval(()=>{fs.mkdirSync(path.join(root,'node_modules'),{recursive:true});fs.writeFileSync(path.join(root,'node_modules','partial'),'incomplete');fs.writeFileSync(path.join(root,'ready'),'ready');},10);`,
  );
  let installer: ChildProcess | undefined;
  vi.mocked(crossSpawn).mockImplementationOnce(
    (_command, _arguments, options) => {
      if (!options) throw new Error("Installer spawn options are required.");
      installer = spawn(process.execPath, [script, directory], options);
      return installer;
    },
  );
  const cancellation = new AbortController();
  const installation = installDependencies(directory, {
    signal: cancellation.signal,
  });
  const rejection = expect(installation).rejects.toThrow("signal=SIGKILL");
  try {
    const deadline = Date.now() + 5000;
    while (!existsSync(marker) && Date.now() < deadline) await delay(10);
    expect(existsSync(marker)).toBe(true);
    cancellation.abort();
    await rejection;
    expect(existsSync(path.join(directory, "node_modules"))).toBe(false);
    await delay(50);
    expect(existsSync(path.join(directory, "node_modules"))).toBe(false);
  } finally {
    cancellation.abort();
    if (
      installer &&
      installer.exitCode === null &&
      installer.signalCode === null
    ) {
      const child = installer;
      const closed = new Promise<void>((resolve) =>
        child.once("close", () => resolve()),
      );
      child.kill("SIGKILL");
      await closed;
    }
    await installation.catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects a missing installer without waiting forever for process exit", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "airjam-install-missing-"),
  );
  vi.mocked(crossSpawn).mockImplementationOnce(
    (_command, _arguments, options) => {
      if (!options) throw new Error("Installer spawn options are required.");
      return spawn(path.join(directory, "missing-installer"), [], options);
    },
  );
  try {
    await expect(installDependencies(directory)).rejects.toThrow("ENOENT");
    expect(existsSync(path.join(directory, "node_modules"))).toBe(false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
