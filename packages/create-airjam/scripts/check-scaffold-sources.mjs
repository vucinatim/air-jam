#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import yauzl from "yauzl";
import {
  scaffoldSourcesRoot as legacyScaffoldSourcesRoot,
  listScaffoldableRepoGameDirectories,
  loadScaffoldableRepoGameManifests,
  scaffoldTemplateManifestPath,
  scaffoldTemplatesRoot,
} from "./lib/scaffold-source-manifests.mjs";
import { generateScaffoldTemplates } from "./lib/scaffold-template-generation.mjs";

const AGENT_CONTRACT_PATH = "src/game/contracts/agent.ts";
const CONFIG_PATH = "src/airjam.config.ts";
const REPAIR_HINT =
  "Run pnpm --filter create-airjam templates:generate, then pnpm check:changed.";

const listFiles = (rootDir, currentDir = rootDir) =>
  fs
    .readdirSync(currentDir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        return listFiles(rootDir, absolutePath);
      }
      return [path.relative(rootDir, absolutePath).replace(/\\/g, "/")];
    });

const { values } = parseArgs({
  options: {
    game: { type: "string", multiple: true },
    help: { type: "boolean" },
  },
});
if (values.help) {
  console.log(
    "Usage: pnpm --filter create-airjam templates:check [--game <game-directory-name>]...",
  );
  console.log(
    "Checks all templates by default; --game checks only the named scaffold inputs.",
  );
  process.exit(0);
}
const gameDirectories = values.game?.map((game) => {
  const directory = listScaffoldableRepoGameDirectories().find(
    (candidate) => path.basename(candidate) === game,
  );
  if (!directory) throw new Error(`Unknown scaffold input: ${game}`);
  return directory;
});

const verifyGeneratedArtifacts = async (templates) => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "airjam-template-check-"),
  );
  const generatedRoot = path.join(tempRoot, "scaffold-templates");

  try {
    await generateScaffoldTemplates({ outputRoot: generatedRoot, templates });
    const expectedFiles = listFiles(generatedRoot);
    const actualFiles = listFiles(scaffoldTemplatesRoot).filter(
      (file) => !gameDirectories || expectedFiles.includes(file),
    );
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
      throw new Error(
        `scaffold template artifact set is stale\nexpected: ${expectedFiles.join(", ")}\nactual: ${actualFiles.join(", ")}\n${REPAIR_HINT}`,
      );
    }

    for (const relativePath of expectedFiles) {
      const expected = fs.readFileSync(path.join(generatedRoot, relativePath));
      let actual = fs.readFileSync(
        path.join(scaffoldTemplatesRoot, relativePath),
      );
      if (gameDirectories && relativePath === "manifest.json") {
        const index = JSON.parse(actual.toString("utf8"));
        index.templates = index.templates.filter((entry) =>
          templates.some(({ manifest }) => manifest.id === entry.manifest.id),
        );
        actual = Buffer.from(`${JSON.stringify(index, null, 2)}\n`);
      }
      if (!actual.equals(expected)) {
        throw new Error(
          `scaffold template artifact ${relativePath} is stale (checked templates: ${templates.map(({ manifest }) => manifest.id).join(", ")})\n${REPAIR_HINT}`,
        );
      }
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
};

const listArchiveEntries = async (archivePath) =>
  await new Promise((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true }, (error, zipFile) => {
      if (error || !zipFile) {
        reject(error ?? new Error(`Failed to open archive ${archivePath}`));
        return;
      }

      const entries = new Set();
      zipFile.readEntry();
      zipFile.on("entry", (entry) => {
        entries.add(entry.fileName.replace(/\\/g, "/"));
        zipFile.readEntry();
      });
      zipFile.once("end", () => resolve(entries));
      zipFile.once("error", reject);
    });
  });

const missing = [];
const expectedTemplates = await loadScaffoldableRepoGameManifests({
  gameDirectories,
});
const expectedTemplateIds = expectedTemplates.map(
  ({ manifest }) => manifest.id,
);
if (fs.existsSync(legacyScaffoldSourcesRoot)) {
  missing.push(
    "legacy scaffold-sources directory exists; packaged templates must live in scaffold-templates archives so editors do not load generated snapshots as live TypeScript projects",
  );
}

if (!fs.existsSync(scaffoldTemplateManifestPath)) {
  missing.push(`missing scaffold template manifest`);
} else {
  const index = JSON.parse(
    fs.readFileSync(scaffoldTemplateManifestPath, "utf8"),
  );
  if (index?.schemaVersion !== 1 || !Array.isArray(index.templates)) {
    missing.push(`invalid scaffold template manifest`);
  } else {
    const actualTemplates = index.templates
      .map((entry) => entry?.manifest?.id)
      .filter(Boolean)
      .sort();

    for (const templateId of gameDirectories ? [] : actualTemplates) {
      if (!expectedTemplateIds.includes(templateId)) {
        missing.push(`unexpected scaffold template ${templateId}`);
      }
    }

    for (const { manifest, gameDir, declaration } of expectedTemplates) {
      const templateId = manifest.id;
      const entry = index.templates.find(
        (candidate) => candidate?.manifest?.id === templateId,
      );
      if (!entry) {
        missing.push(`missing scaffold template ${templateId}`);
        continue;
      }

      if (entry.manifest?.scaffold !== true) {
        missing.push(`scaffold template ${templateId} is not scaffold-enabled`);
      }

      if (typeof entry.archive !== "string" || entry.archive.trim() === "") {
        missing.push(`scaffold template ${templateId} is missing archive`);
        continue;
      }

      if (!fs.existsSync(path.join(scaffoldTemplatesRoot, entry.archive))) {
        missing.push(
          `scaffold template ${templateId} archive ${entry.archive} is missing`,
        );
        continue;
      }

      const archivePath = path.join(scaffoldTemplatesRoot, entry.archive);
      const archiveEntries = await listArchiveEntries(archivePath);
      const sourceHasAgentContract = fs.existsSync(
        path.join(gameDir, AGENT_CONTRACT_PATH),
      );
      const archiveHasAgentContract = archiveEntries.has(AGENT_CONTRACT_PATH);
      if (sourceHasAgentContract !== archiveHasAgentContract) {
        missing.push(
          sourceHasAgentContract
            ? `scaffold template ${templateId} lost ${AGENT_CONTRACT_PATH} during packaging`
            : `scaffold template ${templateId} unexpectedly added ${AGENT_CONTRACT_PATH} during packaging`,
        );
      }

      if (!fs.existsSync(path.join(gameDir, CONFIG_PATH))) {
        missing.push(
          `scaffold template ${templateId} is missing ${CONFIG_PATH}`,
        );
        continue;
      }

      const declaresAgent = Boolean(declaration.agent);

      if (sourceHasAgentContract !== declaresAgent) {
        missing.push(
          sourceHasAgentContract
            ? `scaffold template ${templateId} ships ${AGENT_CONTRACT_PATH} but ${CONFIG_PATH} does not declare agent`
            : `scaffold template ${templateId} declares agent without shipping ${AGENT_CONTRACT_PATH}`,
        );
      }
    }
  }
}

if (missing.length > 0) {
  throw new Error(`${missing.join("\n")}\n${REPAIR_HINT}`);
}

await verifyGeneratedArtifacts(expectedTemplates);

console.log(
  `✓ Scaffold template archives verified in ${scaffoldTemplatesRoot}`,
);
