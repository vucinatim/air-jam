import { runCommandResult } from "./commands.js";
import { detectProjectContext } from "./context.js";
import type { CommandResult, ReadDevLogsOptions } from "./types.js";

const pushOption = (
  args: string[],
  name: string,
  value: string | number | undefined,
): void => {
  if (value !== undefined && value !== "") {
    args.push(`--${name}=${String(value)}`);
  }
};

export const readDevLogs = async (
  options: ReadDevLogsOptions = {},
): Promise<CommandResult & { lines: string[] }> => {
  const context = await detectProjectContext({ cwd: options.cwd });
  const args = ["exec", "air-jam-server", "logs"];

  pushOption(args, "view", options.view ?? "signal");
  pushOption(args, "source", options.source);
  pushOption(args, "trace", options.trace);
  pushOption(args, "room", options.room);
  pushOption(args, "controller", options.controller);
  pushOption(args, "event", options.event);
  pushOption(args, "process", options.process);
  pushOption(args, "level", options.level);
  pushOption(args, "runtime", options.runtime);
  pushOption(args, "epoch", options.epoch);
  pushOption(args, "console-category", options.consoleCategory);
  pushOption(args, "file", options.file);

  const result = runCommandResult({
    command: "pnpm",
    args,
    cwd: context.rootDir,
  });

  const allLines = result.stdout.split(/\r?\n/).filter(Boolean);
  const lines =
    typeof options.tail === "number" && options.tail >= 0
      ? allLines.slice(-options.tail)
      : allLines;

  return {
    ...result,
    stdout: lines.join("\n"),
    lines,
  };
};
