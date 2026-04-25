#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import yauzl from "yauzl";
import {
  scaffoldSourcesRoot as legacyScaffoldSourcesRoot,
  loadScaffoldableRepoGameManifests,
  scaffoldTemplateManifestPath,
  scaffoldTemplatesRoot,
} from "./lib/scaffold-source-manifests.mjs";

const AGENT_CONTRACT_PATH = "src/game/contracts/agent.ts";
const CONFIG_PATH = "src/airjam.config.ts";
const VISUAL_SCENARIOS_PATH = "visual/scenarios.ts";

const readFileIfPresent = (filePath) =>
  fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;

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
const expectedTemplates = loadScaffoldableRepoGameManifests();
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

    for (const templateId of actualTemplates) {
      if (!expectedTemplateIds.includes(templateId)) {
        missing.push(`unexpected scaffold template ${templateId}`);
      }
    }

    for (const { manifest, gameDir } of expectedTemplates) {
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
      const configSource = readFileIfPresent(path.join(gameDir, CONFIG_PATH));
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

      const sourceHasVisualScenarios = fs.existsSync(
        path.join(gameDir, VISUAL_SCENARIOS_PATH),
      );
      const archiveHasVisualScenarios = archiveEntries.has(
        VISUAL_SCENARIOS_PATH,
      );
      if (sourceHasVisualScenarios !== archiveHasVisualScenarios) {
        missing.push(
          sourceHasVisualScenarios
            ? `scaffold template ${templateId} lost ${VISUAL_SCENARIOS_PATH} during packaging`
            : `scaffold template ${templateId} unexpectedly added ${VISUAL_SCENARIOS_PATH} during packaging`,
        );
      }

      if (!configSource) {
        missing.push(
          `scaffold template ${templateId} is missing ${CONFIG_PATH}`,
        );
        continue;
      }

      const declaresAgent =
        configSource.includes("machine:") && configSource.includes("agent:");
      const declaresVisualScenarios = configSource.includes(
        "visualScenariosModule:",
      );

      if (sourceHasAgentContract !== declaresAgent) {
        missing.push(
          sourceHasAgentContract
            ? `scaffold template ${templateId} ships ${AGENT_CONTRACT_PATH} but ${CONFIG_PATH} does not declare game.machine.agent`
            : `scaffold template ${templateId} declares game.machine.agent without shipping ${AGENT_CONTRACT_PATH}`,
        );
      }

      if (sourceHasVisualScenarios !== declaresVisualScenarios) {
        missing.push(
          sourceHasVisualScenarios
            ? `scaffold template ${templateId} ships ${VISUAL_SCENARIOS_PATH} but ${CONFIG_PATH} does not declare game.machine.visualScenariosModule`
            : `scaffold template ${templateId} declares game.machine.visualScenariosModule without shipping ${VISUAL_SCENARIOS_PATH}`,
        );
      }
    }
  }
}

if (missing.length > 0) {
  throw new Error(missing.join("\n"));
}

console.log(
  `✓ Scaffold template archives verified in ${scaffoldTemplatesRoot}`,
);
