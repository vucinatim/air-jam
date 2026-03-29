import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generatePlatformAiPackArtifacts, platformPublicAiPackRoot, readRelativeTree } from "./lib/platform-ai-pack-artifacts.mjs";

const main = async () => {
  const tempRoot = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "airjam-platform-ai-pack-check-"),
  );

  try {
    await generatePlatformAiPackArtifacts({ targetRoot: tempRoot });

    if (!fs.existsSync(platformPublicAiPackRoot)) {
      throw new Error(
        'Hosted AI pack artifacts are missing. Run "pnpm --filter platform ai-pack:generate".',
      );
    }

    const actual = await readRelativeTree(platformPublicAiPackRoot);
    const expected = await readRelativeTree(tempRoot);
    const actualPaths = [...actual.keys()].sort();
    const expectedPaths = [...expected.keys()].sort();

    if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
      throw new Error(
        `Hosted AI pack artifact set is stale.\nExpected: ${expectedPaths.join(", ")}\nActual: ${actualPaths.join(", ")}`,
      );
    }

    for (const relativePath of expectedPaths) {
      if (actual.get(relativePath) !== expected.get(relativePath)) {
        throw new Error(
          `Hosted AI pack artifact is stale: ${relativePath}. Run "pnpm --filter platform ai-pack:generate".`,
        );
      }
    }

    console.log("✓ Hosted AI pack artifacts are complete and fresh");
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  }
};

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
