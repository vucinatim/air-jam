import { runCommand } from "../lib/shell.mjs";

export const registerSmokeCommands = (program) => {
  const smokeCommand = program
    .command("smoke")
    .description("Repo smoke-test helpers");

  smokeCommand
    .command("browser-stack")
    .description("Boot the isolated browser smoke stack for Playwright")
    .action(() => {
      runCommand("node", ["./scripts/repo/smoke/browser-smoke-stack.mjs"]);
    });

  return smokeCommand;
};
