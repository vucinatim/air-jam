import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { repoRoot } from "../lib/paths.mjs";

test(
  "SDK watch builds observe added modules, new directories and replaced source files",
  { timeout: 15_000 },
  async (context) => {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "airjam-sdk-watch-"),
    );
    await fs.writeFile(
      path.join(directory, "package.json"),
      '{"type":"module"}\n',
    );
    await fs.mkdir(path.join(directory, "src"));
    const entry = path.join(directory, "src/index.ts");
    await fs.writeFile(entry, 'export const value = "initial";\n');
    const child = spawn(
      process.execPath,
      [
        path.join(
          repoRoot,
          "packages/sdk/node_modules/tsup/dist/cli-default.js",
        ),
        "src/index.ts",
        "--watch",
        "src",
        "--format",
        "esm",
        "--no-clean",
      ],
      { cwd: directory, stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding("utf8");
      stream.on("data", (value) => {
        output += value;
      });
    }
    context.after(async () => {
      if (child.exitCode === null) {
        const stopped = once(child, "exit");
        child.kill("SIGTERM");
        await stopped;
      }
      await fs.rm(directory, { recursive: true, force: true });
    });
    const waitFor = async (condition) => {
      const deadline = Date.now() + 4_000;
      while (!(await condition())) {
        assert.equal(child.exitCode, null, output);
        assert.ok(
          Date.now() < deadline,
          `Watcher did not produce the expected output:\n${output}`,
        );
        await setTimeout(25);
      }
    };
    await waitFor(() => output.includes("Ignoring changes"));
    // tsup logs its watch configuration before filesystem registration completes.
    await setTimeout(150);
    const moduleDirectory = path.join(directory, "src/added");
    await fs.mkdir(moduleDirectory);
    const module = path.join(moduleDirectory, "value.ts");
    await fs.writeFile(module, 'export const value = "added";\n');
    await fs.writeFile(entry, 'export { value } from "./added/value";\n');
    const hasValue = async (value) =>
      (
        await fs.readFile(path.join(directory, "dist/index.js"), "utf8")
      ).includes(`"${value}"`);
    await waitFor(() => hasValue("added"));
    await fs.writeFile(module, 'export const value = "updated";\n');
    await waitFor(() => hasValue("updated"));
    const replacement = path.join(moduleDirectory, "replacement.ts");
    await fs.writeFile(replacement, 'export const value = "replaced";\n');
    await fs.rename(replacement, module);
    await waitFor(() => hasValue("replaced"));
  },
);
