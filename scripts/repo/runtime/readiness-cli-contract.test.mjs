import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  addReadinessWorkItem,
  applyReadinessWorkItemAddition,
  applyReadinessWorkItemUpdate,
  defaultReadinessManifestPath,
  getReadyWorkItems,
  readReadinessProgram,
  summarizeReadinessProgram,
  updateReadinessWorkItem,
} from "../lib/readiness-program.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const cliPath = path.join(repoRoot, "scripts", "repo", "cli.mjs");

const readHelp = (...args) =>
  execFileSync(process.execPath, [cliPath, ...args, "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

const readUnstartedProgramFixture = () => {
  const program = structuredClone(
    readReadinessProgram(defaultReadinessManifestPath),
  );
  program.updatedAt = "2026-08-26T10:00:00.000Z";
  for (const item of program.workItems) {
    item.status = "pending";
    delete item.owner;
    delete item.evidence;
    delete item.blocker;
    delete item.note;
    delete item.completedAt;
    delete item.updatedAt;
  }
  return program;
};

test("readiness is a discoverable repo CLI surface", () => {
  const rootHelp = readHelp();
  const readinessHelp = readHelp("readiness");
  const updateHelp = readHelp("readiness", "update", "G0-01");

  assert.match(rootHelp, /readiness/);
  assert.match(readinessHelp, /status/);
  assert.match(readinessHelp, /add/);
  assert.match(readinessHelp, /next/);
  assert.match(readinessHelp, /inspect/);
  assert.match(readinessHelp, /validate/);
  assert.match(readinessHelp, /update/);
  assert.match(updateHelp, /read-only\s+preview/);
  assert.match(updateHelp, /--apply/);
  assert.match(updateHelp, /--evidence/);
  assert.match(updateHelp, /--reopen/);
});

test("v1 readiness manifest validates its program structure and root queue", () => {
  const program = readReadinessProgram(defaultReadinessManifestPath);
  const unstartedProgram = readUnstartedProgramFixture();
  const summary = summarizeReadinessProgram(program);
  const rootReadyIds = getReadyWorkItems(unstartedProgram).map(
    (item) => item.id,
  );

  assert.deepEqual(
    program.gates.map((gate) => gate.id),
    ["G0", "G1", "G2", "G3", "G4", "G5", "G6", "G7"],
  );
  assert.ok(program.workItems.length >= 42);
  assert.deepEqual(summary.estimate.total, {
    agentHoursMin: program.estimate.agentHoursMin,
    agentHoursMax: program.estimate.agentHoursMax,
  });
  for (const rootId of ["G0-01", "G0-02", "G1-01", "G3-01", "G5-01"]) {
    assert.ok(rootReadyIds.includes(rootId));
  }
  assert.throws(
    () => getReadyWorkItems(program, { authority: "typo" }),
    /Unsupported readiness authority/,
  );

  const addedId = "TEST-G1-ADDITION";
  const added = addReadinessWorkItem(
    program,
    {
      id: addedId,
      gate: "G1",
      lane: "canonicalization",
      priority: 60,
      title: "Close one newly discovered in-scope audit item",
      authority: "autonomous",
      dependsOn: ["G1-01"],
      estimate: { agentHoursMin: 2, agentHoursMax: 3 },
      evidenceRequirements: ["focused regression proof"],
    },
    { now: "2026-08-26T12:00:00.000Z" },
  ).program;
  assert.equal(added.workItems.length, program.workItems.length + 1);
  assert.equal(
    added.estimate.agentHoursMin,
    program.estimate.agentHoursMin + 2,
  );
  assert.equal(
    added.estimate.agentHoursMax,
    program.estimate.agentHoursMax + 3,
  );
  assert.throws(
    () =>
      addReadinessWorkItem(added, {
        id: addedId,
      }),
    /already exists/,
  );
  assert.throws(
    () =>
      addReadinessWorkItem(program, {
        id: "G1-08",
        authority: "human_checkpoint",
      }),
    /explicit program-definition change/,
  );
});

test("status transitions enforce ownership, dependencies, evidence, and explicit reopening", () => {
  const original = readUnstartedProgramFixture();

  assert.throws(
    () =>
      updateReadinessWorkItem(original, "G0-01", {
        status: "in_progress",
      }),
    /owner/,
  );
  assert.throws(
    () =>
      updateReadinessWorkItem(original, "G0-03", {
        status: "in_progress",
        owner: "/root/program",
      }),
    /incomplete dependencies/,
  );
  assert.throws(
    () =>
      updateReadinessWorkItem(original, "G0-01", {
        status: "complete",
      }),
    /must be claimed in_progress/,
  );

  const claimed = updateReadinessWorkItem(original, "G0-01", {
    status: "in_progress",
    owner: "/root/program",
    now: "2026-08-26T12:00:00.000Z",
  }).program;
  assert.equal(original.workItems[0].status, "pending");
  assert.equal(claimed.workItems[0].status, "in_progress");
  assert.throws(
    () =>
      updateReadinessWorkItem(claimed, "G0-01", {
        status: "in_progress",
        owner: "/root/other-agent",
      }),
    /ownership takeover is not allowed/,
  );

  const completed = updateReadinessWorkItem(claimed, "G0-01", {
    status: "complete",
    owner: "/root/program",
    evidence: ["document:docs/plans/v1-release-roadmap-plan.md"],
    now: "2026-08-26T13:00:00.000Z",
  }).program;
  assert.equal(completed.workItems[0].status, "complete");
  assert.throws(
    () =>
      updateReadinessWorkItem(completed, "G0-01", {
        status: "pending",
      }),
    /--reopen/,
  );
});

test("human and production work cannot complete without their authority evidence", () => {
  const source = readUnstartedProgramFixture();
  const withGateZeroDependencies = structuredClone(source);
  for (const dependencyId of ["G0-01", "G0-02"]) {
    const item = withGateZeroDependencies.workItems.find(
      (entry) => entry.id === dependencyId,
    );
    item.status = "complete";
    item.evidence = ["document:docs/plans/v1-release-roadmap-plan.md"];
    item.completedAt = "2026-08-26T12:00:00.000Z";
    item.updatedAt = item.completedAt;
  }

  assert.throws(
    () =>
      updateReadinessWorkItem(withGateZeroDependencies, "G0-03", {
        status: "complete",
        evidence: ["document:docs/plans/v1-release-roadmap-plan.md"],
      }),
    /decision: evidence/,
  );

  const withProductionDependency = structuredClone(source);
  const candidateItem = withProductionDependency.workItems.find(
    (entry) => entry.id === "G7-01",
  );
  candidateItem.status = "complete";
  candidateItem.evidence = ["command:pnpm-check-release"];
  candidateItem.completedAt = "2026-08-26T12:00:00.000Z";
  candidateItem.updatedAt = candidateItem.completedAt;

  assert.throws(
    () =>
      updateReadinessWorkItem(withProductionDependency, "G7-02", {
        status: "complete",
        evidence: ["command:terminal-success"],
      }),
    /decision: evidence/,
  );
  assert.throws(
    () =>
      updateReadinessWorkItem(withProductionDependency, "G7-02", {
        status: "complete",
        evidence: ["decision:approved"],
      }),
    /command: or url:/,
  );
});

test("manifest writes are explicit and preserve valid JSON state", () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "air-jam-readiness-"),
  );
  const manifestPath = path.join(temporaryDirectory, "program.json");

  try {
    const program = readUnstartedProgramFixture();
    fs.writeFileSync(manifestPath, `${JSON.stringify(program, null, 2)}\n`);

    applyReadinessWorkItemUpdate(manifestPath, "G1-01", {
      status: "in_progress",
      owner: "/root/canonicalization",
      now: "2026-08-26T12:00:00.000Z",
    });
    applyReadinessWorkItemAddition(
      manifestPath,
      {
        id: "TEST-G1-ADDITION",
        gate: "G1",
        lane: "canonicalization",
        priority: 60,
        title: "Close one newly discovered in-scope audit item",
        authority: "autonomous",
        dependsOn: ["G1-01"],
        estimate: { agentHoursMin: 2, agentHoursMax: 3 },
        evidenceRequirements: ["focused regression proof"],
      },
      { now: "2026-08-26T12:05:00.000Z" },
    );

    const persisted = readReadinessProgram(manifestPath);
    assert.equal(
      persisted.workItems.find((item) => item.id === "G1-01").status,
      "in_progress",
    );
    assert.equal(persisted.workItems.length, program.workItems.length + 1);
    assert.equal(
      persisted.estimate.agentHoursMax,
      program.estimate.agentHoursMax + 3,
    );
    assert.equal(fs.existsSync(`${manifestPath}.lock`), false);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
