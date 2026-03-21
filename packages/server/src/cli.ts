#!/usr/bin/env node

/**
 * CLI entry point for @air-jam/server
 * Handles environment variable loading and starts the server
 */

import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAirJamServer } from "./index.js";

// Load .env file if it exists
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", ".env") });

const runtime = createAirJamServer();
runtime.start().catch((error) => {
  console.error("[air-jam] failed to start server", error);
  process.exit(1);
});
