import fs from "node:fs";

type PackageManifest = {
  version?: unknown;
};

const manifest = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageManifest;

if (typeof manifest.version !== "string" || manifest.version.length === 0) {
  throw new Error("@air-jam/mcp-server package version is missing.");
}

export const AIR_JAM_MCP_SERVER_VERSION = manifest.version;
