import { runWorkspaceArcadeTestCommand } from "../../workspace/commands/arcade-test.mjs";
import {
  runWorkspaceArcadeDevCommand,
  runWorkspaceStandaloneDevCommand,
} from "../../workspace/commands/dev.mjs";
import { runWorkspaceSecureInitCommand } from "../../workspace/commands/secure-init.mjs";
import { runWorkspaceTopologyCommand } from "../../workspace/commands/topology.mjs";
import {
  defaultWorkspaceGameId,
  loadRepoGames,
} from "../../workspace/lib/repo-games.mjs";
import { runCommand } from "../lib/shell.mjs";

const formatAvailableGames = () => {
  const lines = loadRepoGames().map((game) => `  - ${game.id}`);
  return ["", "Available games:", ...lines].join("\n");
};

export const registerWorkspaceCommands = (program) => {
  const workspaceCommand = program
    .command("workspace")
    .description("Monorepo runtime and orchestration commands");

  workspaceCommand
    .command("standalone:dev")
    .description("Start live standalone workspace dev for one repo game")
    .option("--game <id>", "Repo game to launch", defaultWorkspaceGameId)
    .option(
      "--secure",
      "Run standalone live dev over trusted local HTTPS",
      false,
    )
    .action(async (options) => {
      await runWorkspaceStandaloneDevCommand({
        gameId: options.game,
        secure: options.secure,
      });
    });

  workspaceCommand
    .command("arcade:dev")
    .description("Start live Arcade workspace dev for one repo game")
    .option(
      "--game <id>",
      "Repo game to launch in Arcade",
      defaultWorkspaceGameId,
    )
    .option("--secure", "Run live Arcade dev over trusted local HTTPS", false)
    .option(
      "--db-studio",
      "Also start Drizzle Studio for the platform database",
      false,
    )
    .action(async (options) => {
      await runWorkspaceArcadeDevCommand({
        gameId: options.game,
        secure: options.secure,
        startDbStudio: options.dbStudio,
      });
    });

  workspaceCommand
    .command("arcade:test")
    .description(
      "Run the stable built local Arcade integration stack for one repo game",
    )
    .option(
      "--game <id>",
      "Repo game to validate in Arcade",
      defaultWorkspaceGameId,
    )
    .option(
      "--secure",
      "Run the Arcade integration stack over trusted local HTTPS",
      false,
    )
    .action(async (options) => {
      await runWorkspaceArcadeTestCommand({
        gameId: options.game,
        secure: options.secure,
      });
    });

  workspaceCommand
    .command("topology")
    .description("Print the resolved runtime topology for a repo game mode")
    .option("--game <id>", "Repo game to inspect", defaultWorkspaceGameId)
    .requiredOption(
      "--mode <mode>",
      "Topology mode to inspect (standalone-dev, arcade-live, arcade-built)",
    )
    .option("--secure", "Resolve the topology using trusted local HTTPS", false)
    .action(async (options) => {
      await runWorkspaceTopologyCommand({
        gameId: options.game,
        mode: options.mode,
        secure: options.secure,
      });
    });

  workspaceCommand
    .command("secure:init")
    .description(
      "Initialize trusted local HTTPS for secure Arcade and standalone game testing",
    )
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
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .argument("[logArgs...]", "Arguments to forward to air-jam-server logs")
    .action((logArgs = []) => {
      runCommand("pnpm", [
        "--filter",
        "@air-jam/server",
        "exec",
        "tsx",
        "src/cli.ts",
        "logs",
        ...logArgs,
      ]);
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
    `\nNotes:\n  - Use \`pnpm standalone:dev --game=<id>\` for live standalone workspace dev.\n  - Use \`pnpm arcade:dev --game=<id>\` for live Arcade workspace dev.\n  - Use \`pnpm arcade:test --game=<id>\` for built local Arcade validation.\n  - Use \`pnpm arcade:test --game=<id> --secure\` for secure built Arcade validation.\n  - Use \`pnpm topology --game=<id> --mode=<mode>\` to inspect resolved repo topologies.\n  - Use \`pnpm logs --view=signal\` for the canonical repo log reader.\n  - Use \`cd games/<id> && pnpm dev -- --secure\` for standalone secure game dev in scaffolded or game-local projects.\n${formatAvailableGames()}`,
  );

  return workspaceCommand;
};
