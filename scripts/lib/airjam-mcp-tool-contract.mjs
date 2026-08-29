import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const contractPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../packages/mcp-server/tool-contract.json",
);
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

export const standaloneGameMcpToolNames = Object.freeze([
  ...contract["standalone-game"],
]);
