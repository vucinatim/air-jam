import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, "../../..");
export const tarballDir = path.join(repoRoot, ".airjam", "tarballs");
export const createAirjamCliEntry = path.join(
  repoRoot,
  "packages",
  "create-airjam",
  "dist",
  "index.js",
);
