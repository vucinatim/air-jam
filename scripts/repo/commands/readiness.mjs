import path from "node:path";

import { repoRoot } from "../lib/paths.mjs";
import {
  addReadinessWorkItem,
  applyReadinessWorkItemAddition,
  applyReadinessWorkItemUpdate,
  defaultReadinessManifestPath,
  getReadyWorkItems,
  readReadinessProgram,
  summarizeReadinessProgram,
  updateReadinessWorkItem,
  validateReadinessProgram,
} from "../lib/readiness-program.mjs";

const parseLimit = (value) => {
  const limit = Number.parseInt(value, 10);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("--limit must be a positive integer.");
  }
  return limit;
};

const collect = (value, previous) => [...previous, value];

const resolveManifestPath = (value) => {
  if (!value) return defaultReadinessManifestPath;
  const resolved = path.resolve(repoRoot, value);
  const relative = path.relative(repoRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("--manifest must resolve inside the repository.");
  }
  return resolved;
};

const printJson = (value) => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const printStatus = (summary) => {
  console.log(`${summary.title} (${summary.id})`);
  console.log(
    `Progress: ${summary.progressPercent}% · ${summary.counts.complete}/${summary.counts.total} complete · ${summary.counts.inProgress} in progress · ${summary.counts.blocked} blocked`,
  );
  console.log(
    `Remaining estimate: ${summary.estimate.remaining.agentHoursMin}-${summary.estimate.remaining.agentHoursMax} agent hours`,
  );
  console.log(
    `Ready: ${summary.ready.autonomous} autonomous · ${summary.ready.humanCheckpoints} human checkpoints · ${summary.ready.productionApprovals} production approvals`,
  );
  console.log("");
  for (const gate of summary.gates) {
    console.log(
      `${gate.id} ${gate.title}: ${gate.counts.complete}/${gate.counts.total} complete, ${gate.counts.inProgress} in progress, ${gate.counts.blocked} blocked`,
    );
  }
  if (summary.blockers.length > 0) {
    console.log("");
    console.log("Blockers:");
    for (const item of summary.blockers) {
      console.log(
        `  ${item.id} [${item.blocker.type}] ${item.blocker.summary}`,
      );
    }
  }
};

const printWorkItems = (items, emptyMessage) => {
  if (items.length === 0) {
    console.log(emptyMessage);
    return;
  }
  for (const item of items) {
    console.log(
      `${item.id} [${item.gate}/${item.lane}] ${item.title} (${item.estimate.agentHoursMin}-${item.estimate.agentHoursMax}h)`,
    );
    if (item.dependsOn.length > 0) {
      console.log(`  depends on: ${item.dependsOn.join(", ")}`);
    }
    console.log(`  evidence: ${item.evidenceRequirements.join("; ")}`);
  }
};

const addManifestOption = (command) =>
  command.option("--manifest <path>", "Repo-relative readiness manifest path");

export const registerReadinessCommands = (program) => {
  const readinessCommand = program
    .command("readiness")
    .description("Inspect and advance the canonical release execution program");

  addManifestOption(
    readinessCommand
      .command("status")
      .description("Summarize release progress, estimates, gates, and blockers")
      .option("--json", "Print stable JSON"),
  ).action((options) => {
    const summary = summarizeReadinessProgram(
      readReadinessProgram(resolveManifestPath(options.manifest)),
    );
    if (options.json) printJson(summary);
    else printStatus(summary);
  });

  addManifestOption(
    readinessCommand
      .command("add <workItemId>")
      .description("Preview or add one newly discovered in-scope work item")
      .requiredOption("--gate <gate>", "Existing release gate id")
      .requiredOption("--lane <lane>", "Execution lane")
      .requiredOption(
        "--priority <priority>",
        "Positive integer priority",
        parseLimit,
      )
      .requiredOption("--title <title>", "Concise work-item title")
      .option(
        "--depends-on <workItemId>",
        "Dependency work item; repeat for multiple dependencies",
        collect,
        [],
      )
      .requiredOption(
        "--agent-hours-min <hours>",
        "Minimum active agent-hour estimate",
        parseLimit,
      )
      .requiredOption(
        "--agent-hours-max <hours>",
        "Maximum active agent-hour estimate",
        parseLimit,
      )
      .option(
        "--evidence-requirement <requirement>",
        "Completion evidence requirement; repeat for multiple requirements",
        collect,
        [],
      )
      .option(
        "--apply",
        "Persist the addition; omission is a read-only preview",
        false,
      )
      .option("--json", "Print stable JSON"),
  ).action((workItemId, options) => {
    if (options.evidenceRequirement.length === 0) {
      throw new Error("At least one --evidence-requirement is required.");
    }
    const manifestPath = resolveManifestPath(options.manifest);
    const workItem = {
      id: workItemId,
      gate: options.gate,
      lane: options.lane,
      priority: options.priority,
      title: options.title,
      authority: "autonomous",
      dependsOn: options.dependsOn,
      estimate: {
        agentHoursMin: options.agentHoursMin,
        agentHoursMax: options.agentHoursMax,
      },
      evidenceRequirements: options.evidenceRequirement,
    };
    const result = options.apply
      ? applyReadinessWorkItemAddition(manifestPath, workItem)
      : addReadinessWorkItem(readReadinessProgram(manifestPath), workItem);
    const output = {
      mode: options.apply ? "applied" : "preview",
      manifest: path.relative(repoRoot, manifestPath),
      workItem: result.workItem,
      summary: summarizeReadinessProgram(result.program),
    };
    if (options.json) printJson(output);
    else {
      console.log(
        `${options.apply ? "Applied" : "Preview"}: added ${workItemId}`,
      );
      if (!options.apply) {
        console.log(
          "No file was changed. Pass --apply to persist this addition.",
        );
      }
    }
  });

  addManifestOption(
    readinessCommand
      .command("next")
      .description("List dependency-ready work without claiming it")
      .option(
        "--authority <authority>",
        "autonomous, human_checkpoint, production_approval, or all",
        "autonomous",
      )
      .option("--lane <lane>", "Only list work in one execution lane")
      .option("--limit <count>", "Maximum work items to return", parseLimit)
      .option("--json", "Print stable JSON"),
  ).action((options) => {
    const programState = readReadinessProgram(
      resolveManifestPath(options.manifest),
    );
    const items = getReadyWorkItems(programState, {
      authority: options.authority,
      lane: options.lane,
      limit: options.limit,
    });
    if (options.json) printJson({ programId: programState.id, items });
    else printWorkItems(items, "No matching work is currently ready.");
  });

  addManifestOption(
    readinessCommand
      .command("inspect <workItemId>")
      .description("Inspect one work item and its current dependency state")
      .option("--json", "Print stable JSON"),
  ).action((workItemId, options) => {
    const programState = readReadinessProgram(
      resolveManifestPath(options.manifest),
    );
    const item = programState.workItems.find(
      (entry) => entry.id === workItemId,
    );
    if (!item) throw new Error(`Unknown readiness work item: ${workItemId}`);
    const dependencies = item.dependsOn.map((dependencyId) => {
      const dependency = programState.workItems.find(
        (entry) => entry.id === dependencyId,
      );
      return {
        id: dependency.id,
        title: dependency.title,
        status: dependency.status,
      };
    });
    const result = { ...item, dependencies };
    if (options.json) printJson(result);
    else printWorkItems([item], "");
  });

  addManifestOption(
    readinessCommand
      .command("validate")
      .description(
        "Validate manifest schema, dependencies, evidence, and links",
      )
      .option("--json", "Print stable JSON"),
  ).action((options) => {
    const manifestPath = resolveManifestPath(options.manifest);
    const programState = readReadinessProgram(manifestPath);
    validateReadinessProgram(programState);
    const result = {
      ok: true,
      programId: programState.id,
      manifest: path.relative(repoRoot, manifestPath),
      gates: programState.gates.length,
      workItems: programState.workItems.length,
    };
    if (options.json) printJson(result);
    else
      console.log(
        `Readiness program is valid: ${result.gates} gates, ${result.workItems} work items.`,
      );
  });

  addManifestOption(
    readinessCommand
      .command("update <workItemId>")
      .description(
        "Preview or apply an evidence-backed work-item status transition",
      )
      .requiredOption(
        "--status <status>",
        "pending, in_progress, blocked, or complete",
      )
      .option("--owner <owner>", "Canonical agent task name or human owner")
      .option(
        "--evidence <reference...>",
        "Evidence as artifact:, command:, decision:, document:, or url:",
      )
      .option(
        "--blocker-type <type>",
        "external, human, or technical when status is blocked",
      )
      .option("--blocker <summary>", "Concise blocker summary")
      .option("--note <note>", "Concise execution note")
      .option("--reopen", "Explicitly reopen completed work", false)
      .option(
        "--apply",
        "Persist the transition; omission is a read-only preview",
        false,
      )
      .option("--json", "Print stable JSON"),
  ).action((workItemId, options) => {
    const manifestPath = resolveManifestPath(options.manifest);
    const updateOptions = {
      status: options.status,
      owner: options.owner,
      evidence: options.evidence ?? [],
      blockerType: options.blockerType,
      blockerSummary: options.blocker,
      note: options.note,
      reopen: options.reopen,
    };
    const result = options.apply
      ? applyReadinessWorkItemUpdate(manifestPath, workItemId, updateOptions)
      : updateReadinessWorkItem(
          readReadinessProgram(manifestPath),
          workItemId,
          updateOptions,
        );
    const output = {
      mode: options.apply ? "applied" : "preview",
      manifest: path.relative(repoRoot, manifestPath),
      workItem: result.workItem,
      summary: summarizeReadinessProgram(result.program),
    };
    if (options.json) printJson(output);
    else {
      console.log(
        `${options.apply ? "Applied" : "Preview"}: ${workItemId} -> ${result.workItem.status}`,
      );
      if (!options.apply) {
        console.log(
          "No file was changed. Pass --apply to persist this transition.",
        );
      }
    }
  });

  return readinessCommand;
};
