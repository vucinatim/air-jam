import { ensureWorkspacePackageBuild } from "../../ensure-workspace-package-build.mjs";
import {
  defaultWorkspaceGameId,
  loadRepoGames,
} from "../../workspace/lib/repo-games.mjs";
import { runCommand } from "../lib/shell.mjs";

let workspaceRuntimePromise;

const loadWorkspaceRuntime = () => {
  workspaceRuntimePromise ??= (async () => {
    await ensureWorkspacePackageBuild("@air-jam/sdk");
    const [dev, secureInit, topology] = await Promise.all([
      import("../../workspace/commands/dev.mjs"),
      import("../../workspace/commands/secure-init.mjs"),
      import("../../workspace/commands/topology.mjs"),
    ]);
    return { ...dev, ...secureInit, ...topology };
  })();
  return workspaceRuntimePromise;
};

export const registerWorkspaceCommands = (program) => {
  const workspaceCommand = program
    .command("workspace")
    .description("Standalone framework development and inspection");

  workspaceCommand
    .command("standalone:dev")
    .description("Start live standalone workspace dev for one repo game")
    .option("--game <id>", "Repo game to launch", defaultWorkspaceGameId)
    .option("--secure", "Use trusted local HTTPS", false)
    .action(async (options) => {
      const { runWorkspaceStandaloneDevCommand } = await loadWorkspaceRuntime();
      await runWorkspaceStandaloneDevCommand({
        gameId: options.game,
        secure: options.secure,
      });
    });

  workspaceCommand
    .command("topology")
    .description("Print the resolved public game runtime topology")
    .option("--game <id>", "Repo game to inspect", defaultWorkspaceGameId)
    .requiredOption(
      "--mode <mode>",
      "standalone-dev, self-hosted-production or hosted-release",
    )
    .option("--secure", "Resolve trusted local HTTPS", false)
    .action(async (options) => {
      const { runWorkspaceTopologyCommand } = await loadWorkspaceRuntime();
      await runWorkspaceTopologyCommand({
        gameId: options.game,
        mode: options.mode,
        secure: options.secure,
      });
    });

  workspaceCommand
    .command("secure:init")
    .description("Initialize trusted local HTTPS for game testing")
    .option("--mode <mode>", "Secure mode to configure (local or tunnel)")
    .option("--hostname <hostname>", "Tunnel hostname for secure tunnel mode")
    .option("--tunnel <name>", "Cloudflare tunnel name for secure tunnel mode")
    .action(async (options) => {
      const { runWorkspaceSecureInitCommand } = await loadWorkspaceRuntime();
      const argv = ["mode", "hostname", "tunnel"].flatMap((name) =>
        options[name] ? [`--${name}`, options[name]] : [],
      );
      await runWorkspaceSecureInitCommand({ argv });
    });

  workspaceCommand
    .command("service <target>")
    .description("Run the standalone room server directly")
    .action((target) => {
      if (target !== "server")
        throw new Error(`Unknown service target "${target}".`);
      runCommand("pnpm", ["--filter", "@air-jam/server", "dev"]);
    });

  workspaceCommand
    .command("logs")
    .description("Stream unified game and server development logs")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .argument("[logArgs...]", "Arguments forwarded to air-jam-server logs")
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

  workspaceCommand.addHelpText(
    "afterAll",
    `\nUse pnpm run dev -- --game=<id> for standalone game development.\nAvailable games:\n${loadRepoGames()
      .map((game) => `  - ${game.id}`)
      .join("\n")}`,
  );
  return workspaceCommand;
};
