import { runCommandResult } from "./commands.js";
import { detectProjectContext } from "./context.js";
import type { CommandResult, RunQualityGateOptions } from "./types.js";

const GATE_TO_SCRIPT: Record<RunQualityGateOptions["gate"], string> = {
  typecheck: "typecheck",
  lint: "lint",
  test: "test",
  build: "build",
  "format-check": "format:check",
  "scaffold-smoke": "test:scaffold",
  "release-check": "check:release",
};

export const runQualityGate = async (
  options: RunQualityGateOptions,
): Promise<CommandResult> => {
  const context = await detectProjectContext({ cwd: options.cwd });
  const script = GATE_TO_SCRIPT[options.gate];

  if (
    context.mode !== "monorepo" &&
    (options.gate === "scaffold-smoke" || options.gate === "release-check")
  ) {
    throw new Error(
      `Quality gate "${options.gate}" is only available in the Air Jam monorepo.`,
    );
  }

  const args = options.packageFilter
    ? ["--filter", options.packageFilter, "run", script]
    : ["run", script];

  return runCommandResult({
    command: "pnpm",
    args,
    cwd: context.rootDir,
  });
};
