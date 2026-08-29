import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { repoRoot } from "./paths.mjs";

export const defaultReadinessManifestPath = path.join(
  repoRoot,
  "scripts",
  "repo",
  "programs",
  "v1-release-program.json",
);

const allowedAuthorities = new Set([
  "autonomous",
  "human_checkpoint",
  "production_approval",
]);
const allowedStatuses = new Set([
  "pending",
  "in_progress",
  "blocked",
  "complete",
]);
const allowedBlockerTypes = new Set(["external", "human", "technical"]);
const evidenceReferencePattern =
  /^(artifact|command|decision|document|url):\S(?:.*\S)?$/u;

const assertString = (value, label) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
};

const assertPositiveInteger = (value, label) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
};

const validateReferencedFile = (relativePath, label) => {
  assertString(relativePath, label);
  if (path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be repo-relative.`);
  }
  if (!fs.existsSync(path.join(repoRoot, relativePath))) {
    throw new Error(`${label} does not exist: ${relativePath}`);
  }
};

const validateGitCommit = (reference, label) => {
  assertString(reference, label);
  const result = spawnSync(
    "git",
    ["rev-parse", "--verify", `${reference}^{commit}`],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`${label} does not resolve to a commit: ${reference}`);
  }
};

const validateArtifactEvidence = (reference, label) => {
  const value = reference.slice("artifact:".length);
  if (value.startsWith("git-range:")) {
    const range = value.slice("git-range:".length);
    const [start, end, ...extra] = range.split("..");
    if (!start || !end || extra.length > 0) {
      throw new Error(`${label} must use artifact:git-range:<start>..<end>.`);
    }
    validateGitCommit(start, `${label} start`);
    validateGitCommit(end, `${label} end`);
    return;
  }
  if (value.startsWith("git:")) {
    validateGitCommit(value.slice("git:".length), label);
    return;
  }
  if (value.startsWith("file:")) {
    validateReferencedFile(value.slice("file:".length), label);
    return;
  }
  throw new Error(
    `${label} must use artifact:git:<commit>, artifact:git-range:<start>..<end>, or artifact:file:<repo-path>.`,
  );
};

const validateGraphIsAcyclic = (itemsById) => {
  const visiting = new Set();
  const visited = new Set();

  const visit = (id, chain) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new Error(
        `Readiness dependency cycle detected: ${[...chain, id].join(" -> ")}`,
      );
    }

    visiting.add(id);
    const item = itemsById.get(id);
    for (const dependencyId of item.dependsOn) {
      visit(dependencyId, [...chain, id]);
    }
    visiting.delete(id);
    visited.add(id);
  };

  for (const id of itemsById.keys()) visit(id, []);
};

export const validateReadinessProgram = (
  program,
  { validateReferencedFiles = true } = {},
) => {
  if (!program || typeof program !== "object" || Array.isArray(program)) {
    throw new Error("Readiness program must be an object.");
  }
  if (program.schemaVersion !== 1) {
    throw new Error(
      `Unsupported readiness schema version: ${program.schemaVersion}`,
    );
  }
  assertString(program.id, "program.id");
  assertString(program.title, "program.title");
  if (program.status !== "active") {
    throw new Error('program.status must be "active".');
  }
  assertString(program.updatedAt, "program.updatedAt");

  if (validateReferencedFiles) {
    validateReferencedFile(program.roadmap, "program.roadmap");
    validateReferencedFile(program.executionPlan, "program.executionPlan");
  }

  if (!Array.isArray(program.gates) || program.gates.length === 0) {
    throw new Error("program.gates must contain at least one gate.");
  }
  if (!Array.isArray(program.workItems) || program.workItems.length === 0) {
    throw new Error("program.workItems must contain at least one work item.");
  }

  const gateIds = new Set();
  for (const gate of program.gates) {
    assertString(gate.id, "gate.id");
    assertString(gate.title, `gate ${gate.id}.title`);
    if (gateIds.has(gate.id)) {
      throw new Error(`Duplicate readiness gate id: ${gate.id}`);
    }
    gateIds.add(gate.id);
    if (!Number.isInteger(gate.wave) || gate.wave < 0) {
      throw new Error(`gate ${gate.id}.wave must be a non-negative integer.`);
    }
  }

  const itemsById = new Map();
  for (const item of program.workItems) {
    assertString(item.id, "workItem.id");
    if (itemsById.has(item.id)) {
      throw new Error(`Duplicate readiness work item id: ${item.id}`);
    }
    itemsById.set(item.id, item);
  }

  for (const item of program.workItems) {
    assertString(item.title, `work item ${item.id}.title`);
    assertString(item.lane, `work item ${item.id}.lane`);
    if (!gateIds.has(item.gate)) {
      throw new Error(
        `work item ${item.id} references unknown gate ${item.gate}.`,
      );
    }
    if (!allowedAuthorities.has(item.authority)) {
      throw new Error(
        `work item ${item.id} has unsupported authority ${item.authority}.`,
      );
    }
    if (!allowedStatuses.has(item.status)) {
      throw new Error(
        `work item ${item.id} has unsupported status ${item.status}.`,
      );
    }
    assertPositiveInteger(item.priority, `work item ${item.id}.priority`);
    if (!Array.isArray(item.dependsOn)) {
      throw new Error(`work item ${item.id}.dependsOn must be an array.`);
    }
    for (const dependencyId of item.dependsOn) {
      if (!itemsById.has(dependencyId)) {
        throw new Error(
          `work item ${item.id} references unknown dependency ${dependencyId}.`,
        );
      }
      if (dependencyId === item.id) {
        throw new Error(`work item ${item.id} cannot depend on itself.`);
      }
    }
    assertPositiveInteger(
      item.estimate?.agentHoursMin,
      `work item ${item.id}.estimate.agentHoursMin`,
    );
    assertPositiveInteger(
      item.estimate?.agentHoursMax,
      `work item ${item.id}.estimate.agentHoursMax`,
    );
    if (item.estimate.agentHoursMin > item.estimate.agentHoursMax) {
      throw new Error(
        `work item ${item.id} minimum estimate exceeds its maximum.`,
      );
    }
    if (
      !Array.isArray(item.evidenceRequirements) ||
      item.evidenceRequirements.length === 0
    ) {
      throw new Error(
        `work item ${item.id}.evidenceRequirements must not be empty.`,
      );
    }

    const evidence = item.evidence ?? [];
    if (!Array.isArray(evidence)) {
      throw new Error(`work item ${item.id}.evidence must be an array.`);
    }
    for (const reference of evidence) {
      if (!evidenceReferencePattern.test(reference)) {
        throw new Error(
          `work item ${item.id} has invalid evidence reference ${reference}.`,
        );
      }
      if (validateReferencedFiles && reference.startsWith("document:")) {
        validateReferencedFile(
          reference.slice("document:".length).split("#", 1)[0],
          `work item ${item.id} document evidence`,
        );
      }
      if (validateReferencedFiles && reference.startsWith("artifact:")) {
        validateArtifactEvidence(
          reference,
          `work item ${item.id} artifact evidence`,
        );
      }
    }
    if (item.status === "complete" && evidence.length === 0) {
      throw new Error(
        `work item ${item.id} cannot be complete without evidence.`,
      );
    }
    if (
      item.status === "complete" &&
      item.authority === "human_checkpoint" &&
      !evidence.some((reference) => reference.startsWith("decision:"))
    ) {
      throw new Error(
        `human checkpoint ${item.id} cannot be complete without decision: evidence.`,
      );
    }
    if (
      item.status === "complete" &&
      item.authority === "production_approval"
    ) {
      if (!evidence.some((reference) => reference.startsWith("decision:"))) {
        throw new Error(
          `production work item ${item.id} cannot be complete without decision: evidence.`,
        );
      }
      if (
        !evidence.some(
          (reference) =>
            reference.startsWith("command:") || reference.startsWith("url:"),
        )
      ) {
        throw new Error(
          `production work item ${item.id} cannot be complete without command: or url: terminal evidence.`,
        );
      }
    }
    if (item.status === "in_progress") {
      assertString(item.owner, `work item ${item.id}.owner`);
    }
    if (item.status === "blocked") {
      assertString(item.owner, `work item ${item.id}.owner`);
      if (!allowedBlockerTypes.has(item.blocker?.type)) {
        throw new Error(
          `work item ${item.id}.blocker.type must be external, human, or technical.`,
        );
      }
      assertString(
        item.blocker?.summary,
        `work item ${item.id}.blocker.summary`,
      );
    }
  }

  for (const item of program.workItems) {
    if (item.status === "pending") continue;
    const incompleteDependencies = item.dependsOn.filter(
      (dependencyId) => itemsById.get(dependencyId)?.status !== "complete",
    );
    if (incompleteDependencies.length > 0) {
      throw new Error(
        `work item ${item.id} has incomplete dependencies: ${incompleteDependencies.join(", ")}`,
      );
    }
  }

  validateGraphIsAcyclic(itemsById);
  const calculatedEstimate = program.workItems.reduce(
    (total, item) => ({
      agentHoursMin: total.agentHoursMin + item.estimate.agentHoursMin,
      agentHoursMax: total.agentHoursMax + item.estimate.agentHoursMax,
    }),
    { agentHoursMin: 0, agentHoursMax: 0 },
  );
  if (
    program.estimate?.agentHoursMin !== calculatedEstimate.agentHoursMin ||
    program.estimate?.agentHoursMax !== calculatedEstimate.agentHoursMax
  ) {
    throw new Error(
      `program estimate must match work-item totals (${calculatedEstimate.agentHoursMin}-${calculatedEstimate.agentHoursMax}).`,
    );
  }
  for (const field of [
    "targetCalendarWeeksMin",
    "targetCalendarWeeksMax",
    "maintainerHoursMin",
    "maintainerHoursMax",
  ]) {
    assertPositiveInteger(
      program.estimate?.[field],
      `program.estimate.${field}`,
    );
  }
  if (
    program.estimate.targetCalendarWeeksMin >
      program.estimate.targetCalendarWeeksMax ||
    program.estimate.maintainerHoursMin > program.estimate.maintainerHoursMax
  ) {
    throw new Error(
      "program estimate minimums must not exceed their maximums.",
    );
  }
  return program;
};

export const readReadinessProgram = (
  manifestPath = defaultReadinessManifestPath,
) => {
  const program = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return validateReadinessProgram(program);
};

export const writeReadinessProgram = (program, manifestPath) => {
  validateReadinessProgram(program);
  const temporaryPath = `${manifestPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(program, null, 2)}\n`);
  fs.renameSync(temporaryPath, manifestPath);
};

const acquireManifestLock = (manifestPath, now = Date.now()) => {
  const lockPath = `${manifestPath}.lock`;
  const tryAcquire = () => {
    const descriptor = fs.openSync(lockPath, "wx");
    fs.writeFileSync(
      descriptor,
      `${JSON.stringify({ pid: process.pid, acquiredAt: new Date(now).toISOString() })}\n`,
    );
    return { descriptor, lockPath };
  };

  try {
    return tryAcquire();
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let ageMs;
    try {
      ageMs = now - fs.statSync(lockPath).mtimeMs;
    } catch (statError) {
      if (statError?.code === "ENOENT") return tryAcquire();
      throw statError;
    }
    if (ageMs <= 5 * 60 * 1000) {
      throw new Error(
        `Readiness manifest is being updated by another operator: ${lockPath}`,
      );
    }
    try {
      fs.unlinkSync(lockPath);
    } catch (unlinkError) {
      if (unlinkError?.code !== "ENOENT") throw unlinkError;
    }
    return tryAcquire();
  }
};

const applyReadinessProgramMutation = (manifestPath, mutate) => {
  const lock = acquireManifestLock(manifestPath);
  try {
    const currentProgram = readReadinessProgram(manifestPath);
    const result = mutate(currentProgram);
    writeReadinessProgram(result.program, manifestPath);
    return result;
  } finally {
    try {
      fs.closeSync(lock.descriptor);
    } finally {
      if (fs.existsSync(lock.lockPath)) fs.unlinkSync(lock.lockPath);
    }
  }
};

export const applyReadinessWorkItemUpdate = (
  manifestPath,
  workItemId,
  options,
) =>
  applyReadinessProgramMutation(manifestPath, (program) =>
    updateReadinessWorkItem(program, workItemId, options),
  );

export const addReadinessWorkItem = (
  program,
  workItem,
  { now = new Date().toISOString() } = {},
) => {
  validateReadinessProgram(program);
  if (program.workItems.some((item) => item.id === workItem.id)) {
    throw new Error(`Readiness work item already exists: ${workItem.id}`);
  }
  if (workItem.authority !== "autonomous") {
    throw new Error(
      "New human checkpoints or production approvals require an explicit program-definition change.",
    );
  }

  const nextItem = {
    ...workItem,
    status: "pending",
    updatedAt: now,
  };
  const nextProgram = {
    ...program,
    updatedAt: now,
    estimate: {
      ...program.estimate,
      agentHoursMin:
        program.estimate.agentHoursMin + nextItem.estimate.agentHoursMin,
      agentHoursMax:
        program.estimate.agentHoursMax + nextItem.estimate.agentHoursMax,
    },
    workItems: [...program.workItems, nextItem],
  };
  validateReadinessProgram(nextProgram);
  return { program: nextProgram, workItem: nextItem };
};

export const applyReadinessWorkItemAddition = (
  manifestPath,
  workItem,
  options,
) =>
  applyReadinessProgramMutation(manifestPath, (program) =>
    addReadinessWorkItem(program, workItem, options),
  );

const itemDependenciesAreComplete = (item, itemsById) =>
  item.dependsOn.every(
    (dependencyId) => itemsById.get(dependencyId)?.status === "complete",
  );

const calculateEstimate = (items) =>
  items.reduce(
    (total, item) => ({
      agentHoursMin: total.agentHoursMin + item.estimate.agentHoursMin,
      agentHoursMax: total.agentHoursMax + item.estimate.agentHoursMax,
    }),
    { agentHoursMin: 0, agentHoursMax: 0 },
  );

export const getReadyWorkItems = (
  program,
  { authority = "autonomous", lane, limit } = {},
) => {
  validateReadinessProgram(program);
  if (authority !== "all" && !allowedAuthorities.has(authority)) {
    throw new Error(`Unsupported readiness authority: ${authority}`);
  }
  const itemsById = new Map(program.workItems.map((item) => [item.id, item]));
  if (lane) {
    const lanes = new Set(program.workItems.map((item) => item.lane));
    if (!lanes.has(lane)) {
      throw new Error(`Unknown readiness lane: ${lane}`);
    }
  }
  const matches = program.workItems
    .filter((item) => item.status === "pending")
    .filter((item) => itemDependenciesAreComplete(item, itemsById))
    .filter((item) => authority === "all" || item.authority === authority)
    .filter((item) => !lane || item.lane === lane)
    .sort((left, right) =>
      left.priority === right.priority
        ? left.id.localeCompare(right.id)
        : left.priority - right.priority,
    );

  return Number.isInteger(limit) ? matches.slice(0, limit) : matches;
};

export const summarizeReadinessProgram = (program) => {
  validateReadinessProgram(program);
  const itemsById = new Map(program.workItems.map((item) => [item.id, item]));
  const totalEstimate = calculateEstimate(program.workItems);
  const completedItems = program.workItems.filter(
    (item) => item.status === "complete",
  );
  const completedEstimate = calculateEstimate(completedItems);
  const remainingItems = program.workItems.filter(
    (item) => item.status !== "complete",
  );
  const remainingEstimate = calculateEstimate(remainingItems);
  const totalMidpoint =
    (totalEstimate.agentHoursMin + totalEstimate.agentHoursMax) / 2;
  const completeMidpoint =
    (completedEstimate.agentHoursMin + completedEstimate.agentHoursMax) / 2;

  const gates = program.gates.map((gate) => {
    const items = program.workItems.filter((item) => item.gate === gate.id);
    return {
      ...gate,
      counts: {
        total: items.length,
        pending: items.filter((item) => item.status === "pending").length,
        inProgress: items.filter((item) => item.status === "in_progress")
          .length,
        blocked: items.filter((item) => item.status === "blocked").length,
        complete: items.filter((item) => item.status === "complete").length,
      },
      remainingEstimate: calculateEstimate(
        items.filter((item) => item.status !== "complete"),
      ),
    };
  });

  const ready = program.workItems.filter(
    (item) =>
      item.status === "pending" && itemDependenciesAreComplete(item, itemsById),
  );

  return {
    id: program.id,
    title: program.title,
    status: program.status,
    updatedAt: program.updatedAt,
    roadmap: program.roadmap,
    executionPlan: program.executionPlan,
    progressPercent:
      totalMidpoint === 0
        ? 0
        : Math.round((completeMidpoint / totalMidpoint) * 100),
    counts: {
      total: program.workItems.length,
      pending: program.workItems.filter((item) => item.status === "pending")
        .length,
      inProgress: program.workItems.filter(
        (item) => item.status === "in_progress",
      ).length,
      blocked: program.workItems.filter((item) => item.status === "blocked")
        .length,
      complete: completedItems.length,
    },
    estimate: {
      total: totalEstimate,
      completed: completedEstimate,
      remaining: remainingEstimate,
    },
    ready: {
      autonomous: ready.filter((item) => item.authority === "autonomous")
        .length,
      humanCheckpoints: ready.filter(
        (item) => item.authority === "human_checkpoint",
      ).length,
      productionApprovals: ready.filter(
        (item) => item.authority === "production_approval",
      ).length,
    },
    gates,
    blockers: program.workItems
      .filter((item) => item.status === "blocked")
      .map(({ id, gate, lane, title, owner, blocker }) => ({
        id,
        gate,
        lane,
        title,
        owner,
        blocker,
      })),
  };
};

const assertDependenciesComplete = (program, item) => {
  const itemsById = new Map(
    program.workItems.map((entry) => [entry.id, entry]),
  );
  const incomplete = item.dependsOn.filter(
    (dependencyId) => itemsById.get(dependencyId)?.status !== "complete",
  );
  if (incomplete.length > 0) {
    throw new Error(
      `work item ${item.id} has incomplete dependencies: ${incomplete.join(", ")}`,
    );
  }
};

export const updateReadinessWorkItem = (
  program,
  workItemId,
  {
    status,
    owner,
    evidence = [],
    blockerType,
    blockerSummary,
    note,
    reopen = false,
    now = new Date().toISOString(),
  },
) => {
  validateReadinessProgram(program);
  if (!allowedStatuses.has(status)) {
    throw new Error(`Unsupported readiness status: ${status}`);
  }
  const itemIndex = program.workItems.findIndex(
    (item) => item.id === workItemId,
  );
  if (itemIndex < 0) {
    throw new Error(`Unknown readiness work item: ${workItemId}`);
  }

  const current = program.workItems[itemIndex];
  if (current.status === "complete" && status !== "complete" && !reopen) {
    throw new Error(
      `work item ${workItemId} is complete; pass --reopen to change it.`,
    );
  }
  if (
    (current.status === "in_progress" || current.status === "blocked") &&
    owner !== current.owner
  ) {
    if (owner === undefined) {
      throw new Error(
        `work item ${workItemId} is claimed by ${current.owner}; pass --owner ${current.owner} to continue it.`,
      );
    }
    throw new Error(
      `work item ${workItemId} is owned by ${current.owner}; ownership takeover is not allowed.`,
    );
  }
  if (
    current.authority === "autonomous" &&
    current.status === "pending" &&
    (status === "blocked" || status === "complete")
  ) {
    throw new Error(
      `autonomous work item ${workItemId} must be claimed in_progress before ${status}.`,
    );
  }
  if (
    status === "in_progress" ||
    status === "blocked" ||
    status === "complete"
  ) {
    assertDependenciesComplete(program, current);
  }
  if (status === "in_progress") {
    assertString(owner ?? current.owner, `work item ${workItemId}.owner`);
  }
  if (status === "blocked") {
    assertString(owner ?? current.owner, `work item ${workItemId}.owner`);
    if (!allowedBlockerTypes.has(blockerType)) {
      throw new Error(
        "--blocker-type must be external, human, or technical when blocking work.",
      );
    }
    assertString(blockerSummary, "--blocker");
  }
  for (const reference of evidence) {
    if (!evidenceReferencePattern.test(reference)) {
      throw new Error(
        `Invalid evidence reference ${reference}; use kind:value with artifact, command, decision, document, or url.`,
      );
    }
  }

  const nextEvidence = [...new Set([...(current.evidence ?? []), ...evidence])];
  if (status === "complete" && nextEvidence.length === 0) {
    throw new Error(
      `work item ${workItemId} cannot be completed without --evidence.`,
    );
  }

  const nextItem = {
    ...current,
    status,
    ...(owner ? { owner } : {}),
    ...(nextEvidence.length > 0 ? { evidence: nextEvidence } : {}),
    ...(note ? { note } : {}),
    updatedAt: now,
  };
  if (status === "blocked") {
    nextItem.blocker = { type: blockerType, summary: blockerSummary };
  } else {
    delete nextItem.blocker;
  }
  if (status === "pending") {
    delete nextItem.owner;
  }
  if (status === "complete") {
    nextItem.completedAt = now;
  } else {
    delete nextItem.completedAt;
  }

  const nextProgram = {
    ...program,
    updatedAt: now,
    workItems: program.workItems.map((item, index) =>
      index === itemIndex ? nextItem : item,
    ),
  };
  validateReadinessProgram(nextProgram);
  return { program: nextProgram, workItem: nextItem };
};
