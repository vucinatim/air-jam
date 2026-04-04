import { Command } from "commander";
import { SECURE_MODE_LOCAL } from "../../../packages/create-airjam/runtime/secure-dev.mjs";
import {
  defaultWorkspaceGameId,
  loadRepoGames,
} from "../../workspace/lib/repo-games.mjs";
import { runCommand } from "../lib/shell.mjs";
import { runWorkspaceArcadeTestCommand } from "../../workspace/commands/arcade-test.mjs";
import { runWorkspaceDevCommand } from "../../workspace/commands/dev.mjs";
import { runWorkspaceSecureInitCommand } from "../../workspace/commands/secure-init.mjs";

const formatAvailableGames = () => {
  const lines = loadRepoGames().map((game) => `  - ${game.id}`);
  return ["", "Available games:", ...lines].join("\n");
};

export const registerWorkspaceCommands = (program) => {
  const workspaceCommand = program
    .command("workspace")
    .description("Monorepo runtime and orchestration commands");

  workspaceCommand
    .command("dev")
    .description("Start the full local workspace stack for one repo game")
    .option("--game <id>", "Repo game to launch", defaultWorkspaceGameId)
    .option("--db-studio", "Also start Drizzle Studio for the platform database", false)
    .option("--pong", "Legacy alias for --game=pong", false)
    .action(async (options) => {
      await runWorkspaceDevCommand({
        gameId: options.pong ? "pong" : options.game,
        startDbStudio: options.dbStudio,
      });
    });

  workspaceCommand
    .command("arcade:test")
    .description("Run the stable local Arcade integration stack for one repo game")
    .option("--game <id>", "Repo game to validate in Arcade", defaultWorkspaceGameId)
    .option("--secure", "Run the Arcade integration stack over trusted local HTTPS", false)
    .option(
      "--secure-mode <mode>",
      "Secure mode to use when --secure is enabled",
      SECURE_MODE_LOCAL,
    )
    .action(async (options) => {
      await runWorkspaceArcadeTestCommand({
        gameId: options.game,
        secure: options.secure,
        secureMode: options.secureMode,
      });
    });

  workspaceCommand
    .command("secure:init")
    .description("Initialize local secure Arcade testing for the workspace")
    .option("--mode <mode>", "Secure mode to configure (local or tunnel)")
    .option("--hostname <hostname>", "Tunnel hostname for secure tunnel mode")
    .option("--tunnel <name>", "Cloudflare tunnel name for secure tunnel mode")
    .action(async (options) => {
      const argv = [];
      if (options.mode) {
        argv.push("--mode", options.mode);
      }
      if (options.hostname) {
        argv.push("--hostname", options.hostname);
      }
      if (options.tunnel) {
        argv.push("--tunnel", options.tunnel);
      }
      await runWorkspaceSecureInitCommand({ argv });
    });

  workspaceCommand
    .command("service <target>")
    .description("Run a single workspace service directly")
    .addHelpText("after", "\nTargets:\n  - server\n  - platform")
    .action((target) => {
      if (target === "server") {
        runCommand("pnpm", ["--filter", "server", "dev"]);
        return;
      }

      if (target === "platform") {
        runCommand("pnpm", ["--filter", "platform", "dev"]);
        return;
      }

      throw new Error(`Unknown service target "${target}".`);
    });

  workspaceCommand
    .command("logs")
    .description("Stream the Air Jam server development logs")
    .action(() => {
      runCommand("pnpm", ["--filter", "@air-jam/server", "logs:dev"]);
    });

  const analyticsCommand = workspaceCommand
    .command("analytics")
    .description("Workspace analytics maintenance");

  analyticsCommand
    .command("rebuild")
    .description("Rebuild analytics state for the Air Jam server")
    .action(() => {
      runCommand("pnpm", ["--filter", "@air-jam/server", "analytics:rebuild"]);
    });

  workspaceCommand.addHelpText?.(
    "afterAll",
    `\nNotes:\n  - Use \`pnpm dev -- --game=<id>\` for fast live development.\n  - Use \`pnpm arcade:test -- --game=<id> --secure\` for stable secure Arcade validation.\n${formatAvailableGames()}`,
  );

  return workspaceCommand;
};
