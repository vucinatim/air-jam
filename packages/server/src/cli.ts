#!/usr/bin/env node

/**
 * CLI entry point for @air-jam/server
 * Handles environment variable loading and starts the server
 */

import { formatEnvValidationError, isEnvValidationError } from "@air-jam/env";
import { AIRJAM_DEV_LOG_EVENTS } from "@air-jam/sdk/protocol";
import { Command } from "commander";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadWorkspaceEnv } from "./env/load-workspace-env.js";
import {
  coerceDevLogsCliOptions,
  configureDevLogsCommand,
  executeDevLogsCliOptions,
} from "./logging/dev-logs-cli.js";
import { createServerLogger } from "./logging/logger.js";

const runServer = async (): Promise<number> => {
  try {
    loadWorkspaceEnv();
    const { createAirJamServer } = await import("./index.js");
    const runtime = createAirJamServer();
    await runtime.start();
    return 0;
  } catch (error) {
    if (isEnvValidationError(error)) {
      console.error(
        formatEnvValidationError(error, {
          docsHint:
            "Fix the listed AIR_JAM_* variables and retry. For local dev, check .env.local or packages/server/.env.",
        }),
      );
      return 1;
    }

    const logger = createServerLogger({ service: "air-jam-server" });
    logger.error(
      { event: AIRJAM_DEV_LOG_EVENTS.server.startupFailed, err: error },
      "Failed to start server",
    );
    return 1;
  }
};

export const normalizeCliArgv = (argv: string[]): string[] => {
  if (argv.length >= 4 && argv[2] === "logs" && argv[3] === "--") {
    return [argv[0], argv[1], argv[2], ...argv.slice(4)];
  }

  return argv;
};

const normalizeProjectCliArgv = (argv: string[]): string[] =>
  argv.filter((value) => value !== "--");

export const createServerCli = (): Command => {
  const program = new Command();
  program
    .name("air-jam-server")
    .description("Air Jam development and production server")
    .action(async () => {
      process.exitCode = await runServer();
    });

  program
    .command("start")
    .description("Start the Air Jam server")
    .action(async () => {
      process.exitCode = await runServer();
    });

  configureDevLogsCommand(program.command("logs")).action(async (options) => {
    process.exitCode = await executeDevLogsCliOptions(
      coerceDevLogsCliOptions(options as Record<string, unknown>),
    );
  });

  program
    .command("status")
    .description("Show local Air Jam dev process and known-port status")
    .option("--dir <path>", "Project directory to inspect")
    .action(async (options: { dir?: string }) => {
      const { getDevStatus } = await import("./project-cli/local-dev-state.mjs");
      const status = await getDevStatus({ cwd: options.dir });
      process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    });

  const resetCommand = program
    .command("reset")
    .description("Reset local Air Jam development state");

  resetCommand
    .command("local")
    .description(
      "Stop managed dev processes and stale known-port Air Jam local listeners",
    )
    .option("--dir <path>", "Project directory to reset")
    .action(async (options: { dir?: string }) => {
      const { resetLocalDev } = await import("./project-cli/local-dev-state.mjs");
      const result = await resetLocalDev({ cwd: options.dir });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    });

  program
    .command("dev")
    .description("Run project-local Air Jam game development")
    .argument("[passthrough...]", "Additional runtime flags")
    .allowExcessArguments(true)
    .allowUnknownOption(false)
    .option("--secure", "Start secure local game dev", false)
    .option(
      "--secure-mode <mode>",
      "Secure mode to use when --secure is enabled (local or tunnel)",
    )
    .option(
      "--preview-managed",
      "Advanced/internal: start foreground Vite with a background server",
      false,
    )
    .option("--web-only", "Start only the game app", false)
    .option("--server-only", "Start only the local Air Jam server", false)
    .option(
      "--allow-existing-game",
      "Reuse an already-running Vite server on the game port",
      false,
    )
    .action(async () => {
      const { runGameDevCli } = await import("./project-cli/game-dev.mjs");
      await runGameDevCli({
        argv: normalizeProjectCliArgv(process.argv.slice(3)),
      });
    });

  program
    .command("secure:init")
    .description("Initialize local secure Air Jam game development")
    .argument("[passthrough...]", "Additional runtime flags")
    .allowExcessArguments(true)
    .allowUnknownOption(false)
    .option("--mode <mode>", "Secure mode to configure (local or tunnel)")
    .option("--hostname <hostname>", "Tunnel hostname for secure tunnel mode")
    .option("--tunnel <name>", "Cloudflare tunnel name for secure tunnel mode")
    .action(async () => {
      const { runSecureInitCli } = await import("./project-cli/secure-dev.mjs");
      await runSecureInitCli({
        argv: normalizeProjectCliArgv(process.argv.slice(3)),
      });
    });

  program
    .command("topology")
    .description(
      "Print the resolved project runtime topology for the current game",
    )
    .allowUnknownOption(false)
    .requiredOption(
      "--mode <mode>",
      "Topology mode to inspect (standalone-dev, self-hosted-production, hosted-release)",
    )
    .option(
      "--secure",
      "Resolve standalone local topology using trusted local HTTPS",
      false,
    )
    .action(async () => {
      const { runProjectTopologyCli } = await import("./project-cli/topology.mjs");
      await runProjectTopologyCli({
        argv: normalizeProjectCliArgv(process.argv.slice(3)),
      });
    });

  return program;
};

export const formatCliHelp = (): string => createServerCli().helpInformation();

const main = async (): Promise<number> => {
  loadWorkspaceEnv();
  await createServerCli().parseAsync(normalizeCliArgv(process.argv));
  const exitCode = process.exitCode;
  if (typeof exitCode === "number") {
    return exitCode;
  }
  return exitCode ? Number(exitCode) : 0;
};

const resolveIsDirectRun = (): boolean => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  if (pathToFileURL(entry).href === import.meta.url) {
    return true;
  }

  const entryBaseName = path.basename(entry);
  return entryBaseName === "air-jam-server" || entryBaseName === "cli.js";
};

const isDirectRun = resolveIsDirectRun();

if (isDirectRun) {
  void main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
