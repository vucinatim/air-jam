#!/usr/bin/env node

/**
 * CLI entry point for @air-jam/server
 * Handles environment variable loading and starts the server
 */

import { AIRJAM_DEV_LOG_EVENTS } from "@air-jam/sdk/protocol";
import { loadWorkspaceEnv } from "./env/load-workspace-env.js";
import { createServerLogger } from "./logging/logger.js";
import { createAirJamServer } from "./index.js";

loadWorkspaceEnv();

const logger = createServerLogger({ service: "air-jam-server" });
const runtime = createAirJamServer({ logger });
runtime.start().catch((error) => {
  logger.error(
    { event: AIRJAM_DEV_LOG_EVENTS.server.startupFailed, err: error },
    "Failed to start server",
  );
  process.exit(1);
});
