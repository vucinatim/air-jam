#!/usr/bin/env node

import { Command } from "commander";
import { defaultWorkspaceGameId, loadRepoGames } from "./lib/repo-games.mjs";
import { runCommand } from "./lib/shell.mjs";
import { SECURE_MODE_LOCAL } from "../../packages/create-airjam/runtime/secure-dev.mjs";
import { runWorkspaceDevCommand } from "./commands/dev.mjs";
import { runWorkspaceArcadeTestCommand } from "./commands/arcade-test.mjs";
import { runWorkspaceSecureInitCommand } from "./commands/secure-init.mjs";
import { runWorkspaceScaffoldLocalCommand } from "./commands/scaffold-local.mjs";
import { runWorkspacePackLocalCommand } from "./commands/pack-local.mjs";
import { runWorkspacePlatformDbBackupCommand } from "./commands/platform-db-backup.mjs";
import { runWorkspaceLegacyValidateTarballCommand } from "./commands/legacy-validate-tarball.mjs";

const formatAvailableGames = () => {
  const lines = loadRepoGames().map((game) => `  - ${game.id}`);
  return ["", "Available games:", ...lines].join("\n");
};

const program = new Command();

program
  .name("air-jam-workspace")
  .description("Repo-local Air Jam monorepo orchestration CLI");

program
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

program
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

program
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

program
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

program
  .command("logs")
  .description("Stream the Air Jam server development logs")
  .action(() => {
    runCommand("pnpm", ["--filter", "@air-jam/server", "logs:dev"]);
  });

const analyticsCommand = program
  .command("analytics")
  .description("Workspace analytics maintenance");

analyticsCommand
  .command("rebuild")
  .description("Rebuild analytics state for the Air Jam server")
  .action(() => {
    runCommand("pnpm", ["--filter", "@air-jam/server", "analytics:rebuild"]);
  });

const perfCommand = program.command("perf").description("Workspace performance checks");

perfCommand
  .command("sanity")
  .description("Run the server performance sanity check")
  .argument("[passthrough...]", "Additional perf:sanity flags")
  .action((passthrough = []) => {
    const args = ["--filter", "server", "perf:sanity"];
    if (passthrough.length > 0) {
      args.push("--", ...passthrough);
    }
    runCommand("pnpm", args);
  });

const platformCommand = program.command("platform").description("Platform maintenance helpers");

platformCommand
  .command("db-backup")
  .description("Write a local backup of the platform database")
  .action(() => {
    runWorkspacePlatformDbBackupCommand();
  });

program
  .command("pack-local")
  .description("Pack local SDK/server/create-airjam tarballs under .airjam/tarballs")
  .action(() => {
    runWorkspacePackLocalCommand();
  });

program
  .command("scaffold-local <projectName>")
  .description("Scaffold a local game against workspace, tarball, or registry dependencies")
  .option("--source <source>", "Dependency source to use", "tarball")
  .option("--template <template>", "Template game to scaffold", "pong")
  .action((projectName, options) => {
    runWorkspaceScaffoldLocalCommand({
      projectName,
      source: options.source,
      template: options.template,
    });
  });

const legacyCommand = program.command("legacy").description("Legacy game validation helpers");

legacyCommand
  .command("validate-tarball")
  .description("Validate legacy ZeroDays games against local SDK/server tarballs")
  .action(() => {
    runWorkspaceLegacyValidateTarballCommand();
  });

program.addHelpText?.(
  "afterAll",
  `\nNotes:\n  - Use \`pnpm dev -- --game=<id>\` for fast live development.\n  - Use \`pnpm arcade:test -- --game=<id> --secure\` for stable secure Arcade validation.\n${formatAvailableGames()}`,
);

await program.parseAsync(process.argv.filter((value) => value !== "--"));
