import { execFileSync, spawnSync } from "node:child_process";
import { repoRoot } from "./paths.mjs";

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
    env: {
      ...baseEnv(),
      ...(options.env ?? {}),
    },
  });
