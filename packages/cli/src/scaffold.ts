import {
  AIRJAM_PROJECT_MCP_FILE,
  createProjectLocalMcpConfig,
} from "@air-jam/mcp-server/config";
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
