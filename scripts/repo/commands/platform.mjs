import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertGeneratedContentBlogSourceIsFresh,
  writeGeneratedContentBlogSource,
} from "../../content/lib/content-blog-source-generator.mjs";
import {
  assertGeneratedContentDocsSourceIsFresh,
  writeGeneratedContentDocsSource,
} from "../../content/lib/content-docs-source-generator.mjs";
import {
  generatePlatformAiPackArtifacts,
  platformPublicAiPackRoot,
  readRelativeTree,
} from "../../platform/lib/platform-ai-pack-artifacts.mjs";
import { runRepoPlatformDbBackupCommand } from "./platform-db-backup.mjs";

const runPlatformGeneratedPrepare = async () => {
  await Promise.all([
    writeGeneratedContentDocsSource(),
    writeGeneratedContentBlogSource(),
  ]);

  const result = await generatePlatformAiPackArtifacts();

  console.log(
    `✓ Platform generated artifacts are ready (${result.channel}@${result.packVersion}, ${result.fileCount} files)`,
  );
};

const runPlatformGeneratedCheck = async () => {
  await Promise.all([
    assertGeneratedContentDocsSourceIsFresh(),
    assertGeneratedContentBlogSourceIsFresh(),
  ]);

  const tempRoot = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "airjam-platform-ai-pack-check-"),
  );

  try {
    await generatePlatformAiPackArtifacts({ targetRoot: tempRoot });

    if (!fs.existsSync(platformPublicAiPackRoot)) {
      throw new Error(
        'Hosted AI pack artifacts are missing. Run "pnpm run repo -- platform ai-pack generate".',
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
          `Hosted AI pack artifact is stale: ${relativePath}. Run "pnpm run repo -- platform ai-pack generate".`,
        );
      }
    }

    console.log("✓ Platform generated artifacts are complete and fresh");
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  }
};

const runPlatformAiPackCheck = async () => {
  const tempRoot = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "airjam-platform-ai-pack-check-"),
  );

  try {
    await generatePlatformAiPackArtifacts({ targetRoot: tempRoot });

    if (!fs.existsSync(platformPublicAiPackRoot)) {
      throw new Error(
        'Hosted AI pack artifacts are missing. Run "pnpm run repo -- platform ai-pack generate".',
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
          `Hosted AI pack artifact is stale: ${relativePath}. Run "pnpm run repo -- platform ai-pack generate".`,
        );
      }
    }

    console.log("✓ Hosted platform AI pack artifacts are fresh");
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  }
};

export const registerPlatformCommands = (program) => {
  const platformCommand = program
    .command("platform")
    .description("Platform maintainer helpers");

  const generatedCommand = platformCommand
    .command("generated")
    .description("Prepare or verify generated platform artifacts");

  generatedCommand
    .command("prepare")
    .description(
      "Generate platform content sources and hosted AI pack artifacts",
    )
    .action(runPlatformGeneratedPrepare);

  generatedCommand
    .command("check")
    .description(
      "Verify platform content sources and hosted AI pack artifacts are fresh",
    )
    .action(runPlatformGeneratedCheck);

  const aiPackCommand = platformCommand
    .command("ai-pack")
    .description("Hosted platform AI pack artifact helpers");

  aiPackCommand
    .command("generate")
    .description("Generate hosted platform AI pack artifacts")
    .action(async () => {
      const result = await generatePlatformAiPackArtifacts();
      console.log(
        `✓ Generated hosted AI pack artifacts for ${result.channel}@${result.packVersion} (${result.fileCount} files)`,
      );
    });

  aiPackCommand
    .command("check")
    .description("Verify hosted platform AI pack artifacts are fresh")
    .action(async () => {
      await runPlatformAiPackCheck();
    });

  platformCommand
    .command("db-backup")
    .description("Write a local backup of the platform database")
    .action(() => {
      runRepoPlatformDbBackupCommand();
    });

  return platformCommand;
};
