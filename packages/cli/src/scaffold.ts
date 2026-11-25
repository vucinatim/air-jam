import {
  AIRJAM_PROJECT_MCP_FILE,
  createProjectLocalMcpConfig,
} from "@air-jam/devtools/mcp-config";
import {
  AIR_JAM_HOSTED_ENVIRONMENTS,
  type AirJamHostedEnvironment,
} from "@air-jam/sdk/core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const resolveAirJamManagedAssetsDir = (): string =>
  path.join(packageRoot, "template-assets", "managed");

export const resolveAirJamBootstrapAssetsDir = (): string =>
  path.join(packageRoot, "template-assets", "bootstrap");

export { AIRJAM_PROJECT_MCP_FILE, createProjectLocalMcpConfig };

/**
 * The hosted Air Jam a new game publishes to: a prerelease scaffolder builds
 * against beta, a release against production.
 */
export const resolveScaffoldHostedEnvironment = (
  createAirJamVersion: string,
): AirJamHostedEnvironment =>
  AIR_JAM_HOSTED_ENVIRONMENTS[createAirJamVersion.includes("-") ? 1 : 0];
