import fs from "node:fs/promises";

import {
  aiPackManifestPath,
  createAiPackBuildManifest,
} from "./ai-pack-contract.mjs";

const currentManifest = JSON.parse(
  await fs.readFile(aiPackManifestPath, "utf8"),
);
const manifest = await createAiPackBuildManifest({ currentManifest });
await fs.writeFile(
  aiPackManifestPath,
  `${JSON.stringify(manifest, null, 2)}\n`,
);
