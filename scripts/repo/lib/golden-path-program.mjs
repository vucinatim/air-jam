import fs from "node:fs";
import path from "node:path";

import { repoRoot } from "./paths.mjs";

export const defaultGoldenPathManifestPath = path.join(
  repoRoot,
  "scripts",
  "repo",
  "programs",
  "v1-external-agent-golden-path.json",
);

const requiredStageIds = [
  "preflight",
  "create",
  "discover",
  "build",
  "control",
  "inspect",
  "repair",
  "evaluate",
  "release",
  "verify",
];

const allowedActors = new Set([
  "run-controller",
  "primary-agent",
  "secondary-client",
  "verifier",
]);

const assertString = (value, label) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
};

const assertStringArray = (value, label) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array.`);
  }
  for (const [index, entry] of value.entries()) {
    assertString(entry, `${label}[${index}]`);
  }
};

const validateRepoFile = (relativePath, label) => {
  assertString(relativePath, label);
  if (path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be repo-relative.`);
  }
  const resolved = path.resolve(repoRoot, relativePath);
  const relative = path.relative(repoRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must resolve inside the repository.`);
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`${label} does not exist: ${relativePath}`);
  }
};

export const validateGoldenPathProgram = (
  program,
  { validateReferencedFiles = true } = {},
) => {
  if (!program || typeof program !== "object" || Array.isArray(program)) {
    throw new Error("Golden-path program must be an object.");
  }
  if (program.schemaVersion !== 1) {
    throw new Error(
      `Unsupported golden-path schema version: ${program.schemaVersion}`,
    );
  }
  assertString(program.id, "program.id");
  assertString(program.title, "program.title");
  assertString(program.contract, "program.contract");
  assertString(program.promptTemplate, "program.promptTemplate");
  if (validateReferencedFiles) {
    validateRepoFile(program.contract, "program.contract");
    validateRepoFile(program.promptTemplate, "program.promptTemplate");
  }

  if (program.clients?.primary?.profile !== "codex") {
    throw new Error('program.clients.primary.profile must be "codex".');
  }
  if (program.clients?.secondary?.profile !== "claude-desktop") {
    throw new Error(
      'program.clients.secondary.profile must be "claude-desktop".',
    );
  }
  assertStringArray(
    program.clients.primary.requiredProof,
    "program.clients.primary.requiredProof",
  );
  assertStringArray(
    program.clients.secondary.requiredProof,
    "program.clients.secondary.requiredProof",
  );

  if (program.publication?.productionAllowed !== false) {
    throw new Error("program.publication.productionAllowed must be false.");
  }
  if (program.publication?.arcadeVisibility !== "hidden") {
    throw new Error('program.publication.arcadeVisibility must be "hidden".');
  }
  assertString(program.publication?.target, "program.publication.target");

  assertStringArray(program.isolation?.required, "program.isolation.required");
  assertStringArray(
    program.isolation?.forbidden,
    "program.isolation.forbidden",
  );
  assertString(program.evidenceBundle?.format, "program.evidenceBundle.format");
  assertStringArray(
    program.evidenceBundle?.requiredPaths,
    "program.evidenceBundle.requiredPaths",
  );
  assertStringArray(
    program.evidenceBundle?.redactions,
    "program.evidenceBundle.redactions",
  );

  if (!Array.isArray(program.stages) || program.stages.length === 0) {
    throw new Error("program.stages must be a non-empty array.");
  }
  const stageIds = new Set();
  for (const [index, stage] of program.stages.entries()) {
    assertString(stage.id, `program.stages[${index}].id`);
    if (stageIds.has(stage.id)) {
      throw new Error(`Duplicate golden-path stage id: ${stage.id}`);
    }
    stageIds.add(stage.id);
    assertString(stage.actor, `stage ${stage.id}.actor`);
    if (!allowedActors.has(stage.actor)) {
      throw new Error(
        `stage ${stage.id}.actor must be one of: ${[...allowedActors].join(", ")}.`,
      );
    }
    assertString(stage.objective, `stage ${stage.id}.objective`);
    assertStringArray(stage.success, `stage ${stage.id}.success`);
    assertStringArray(stage.evidence, `stage ${stage.id}.evidence`);
  }

  const actualStageIds = program.stages.map((stage) => stage.id);
  if (JSON.stringify(actualStageIds) !== JSON.stringify(requiredStageIds)) {
    throw new Error(
      `Golden-path stages must be exactly: ${requiredStageIds.join(" -> ")}.`,
    );
  }

  return program;
};

export const readGoldenPathProgram = (
  manifestPath = defaultGoldenPathManifestPath,
) => {
  const program = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return validateGoldenPathProgram(program);
};

export const summarizeGoldenPathProgram = (program) => ({
  schemaVersion: program.schemaVersion,
  id: program.id,
  title: program.title,
  contract: program.contract,
  promptTemplate: program.promptTemplate,
  clients: program.clients,
  publication: program.publication,
  isolation: program.isolation,
  evidenceBundle: program.evidenceBundle,
  stages: program.stages,
});
