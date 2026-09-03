import { execFile, execFileSync, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { repoRoot } from "./paths.mjs";

const execFileAsync = promisify(execFile);

const baseEnv = () => ({
  ...process.env,
  CI: process.env.CI ?? "1",
  NO_UPDATE_NOTIFIER: "1",
});

export const runCommand = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: options.stdio ?? "inherit",
    encoding: options.encoding,
    maxBuffer: options.maxBuffer,
    env: {
      ...baseEnv(),
      ...(options.env ?? {}),
    },
  });

export const runCommandResult = (command, args, options = {}) =>
  spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: options.stdio ?? "inherit",
    encoding: options.encoding ?? "utf8",
    maxBuffer: options.maxBuffer,
    env: {
      ...baseEnv(),
      ...(options.env ?? {}),
    },
  });

export const runCommandCaptured = async (command, args, options = {}) => {
  const startedAt = performance.now();
  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: {
        ...baseEnv(),
        ...(options.env ?? {}),
      },
      maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
      encoding: "utf8",
    });
    return {
      command: [command, ...args].join(" "),
      durationMs: Math.round(performance.now() - startedAt),
      stdout: result.stdout.trim(),
    };
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${[command, ...args].join(" ")} failed${output ? `:\n${output}` : ""}`);
  }
};
