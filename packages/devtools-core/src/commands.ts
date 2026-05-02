import { spawnSync } from "node:child_process";
import type { CommandResult } from "./types.js";

const createBaseEnv = (): NodeJS.ProcessEnv => ({
  ...process.env,
  CI: process.env.CI ?? "1",
  NO_UPDATE_NOTIFIER: "1",
});

export const runCommandResult = ({
  command,
  args,
  cwd,
}: {
  command: string;
  args: string[];
  cwd: string;
}): CommandResult => {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: createBaseEnv(),
  });

  const exitCode = result.status ?? null;
  return {
    command,
    args,
    cwd,
    exitCode,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr:
      result.stderr ??
      (result.error instanceof Error ? result.error.message : ""),
    durationMs: Date.now() - startedAt,
    ok: exitCode === 0 && !result.error,
  };
};
