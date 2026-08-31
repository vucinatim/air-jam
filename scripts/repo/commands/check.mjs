import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildChangedCheckPlan } from "../lib/check-plan.mjs";
import { repoRoot } from "../lib/paths.mjs";
import { runCommand, runCommandCaptured } from "../lib/shell.mjs";
const cacheRoot = path.join(repoRoot, "node_modules/.cache/airjam-check");

const gitOutput = (args) =>
  execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const nullSeparated = (value) => value.split("\0").filter(Boolean);

const collectChangedFiles = (base) => {
  const mergeBase = gitOutput(["merge-base", base, "HEAD"]);
  const groups = [
    nullSeparated(gitOutput(["diff", "--name-only", "-z", `${mergeBase}..HEAD`])),
    nullSeparated(gitOutput(["diff", "--name-only", "-z"])),
    nullSeparated(gitOutput(["diff", "--cached", "--name-only", "-z"])),
    nullSeparated(gitOutput(["ls-files", "--others", "--exclude-standard", "-z"])),
  ];

  return {
    mergeBase,
    files: [...new Set(groups.flat())].sort(),
  };
};

const assertDiffHygiene = (mergeBase) => {
  runCommand("git", ["diff", "--check", `${mergeBase}..HEAD`]);
  runCommand("git", ["diff", "--check"]);
  runCommand("git", ["diff", "--cached", "--check"]);
};

const runInstant = async (plan, mergeBase) => {
  const startedAt = performance.now();
  assertDiffHygiene(mergeBase);

  for (const file of plan.instant.jsonFiles) {
    JSON.parse(readFileSync(path.join(repoRoot, file), "utf8"));
  }

  const syntaxResults = await Promise.all(
    plan.instant.nodeSyntaxFiles.map((file) =>
      runCommandCaptured(process.execPath, ["--check", path.join(repoRoot, file)]),
    ),
  );

  return {
    durationMs: Math.round(performance.now() - startedAt),
    syntaxResults,
  };
};

const lintTasks = (files) => {
  const executable = path.join(repoRoot, "node_modules/.bin/eslint");
  const platformPrefix = "apps/platform/";
  const platformFiles = files
    .filter((file) => file.startsWith(platformPrefix))
    .map((file) => file.slice(platformPrefix.length));
  const rootFiles = files.filter((file) => !file.startsWith(platformPrefix));
  const tasks = [];

  if (rootFiles.length > 0) {
    tasks.push(
      runCommandCaptured(executable, [
        ...rootFiles,
        "--cache",
        "--cache-location",
        path.join(cacheRoot, "eslint-root"),
      ]),
    );
  }
  if (platformFiles.length > 0) {
    tasks.push(
      runCommandCaptured(
        executable,
        [
          ...platformFiles,
          "--cache",
          "--cache-location",
          path.join(cacheRoot, "eslint-platform"),
        ],
        { cwd: path.join(repoRoot, "apps/platform") },
      ),
    );
  }

  return tasks;
};

const typecheckTasks = (projects) => {
  const executable = path.join(repoRoot, "node_modules/.bin/tsc");
  return projects.map((project) => {
    const cacheName = project.replaceAll("/", "-");
    return runCommandCaptured(executable, [
      "-p",
      path.join(project, "tsconfig.json"),
      "--noEmit",
      "--incremental",
      "--tsBuildInfoFile",
      path.join(cacheRoot, `${cacheName}.tsbuildinfo`),
    ]);
  });
};

const emitResult = (result, json) => {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  console.log(
    `${result.tier} check passed in ${result.durationMs}ms (${result.changedFiles.length} changed files).`,
  );
  if (result.targetExceeded) {
    console.log(
      `Warm target ${result.targetWarmMs}ms was exceeded; retain this timing as optimization evidence.`,
    );
  }
};

const emitPlan = (plan, json) => {
  if (json) {
    process.stdout.write(`${JSON.stringify({ tier: "plan", ...plan }, null, 2)}\n`);
    return;
  }

  console.log(`Changed files: ${plan.changedFiles.length}`);
  console.log(`Lint files: ${plan.changed.lintFiles.length}`);
  console.log(
    `TypeScript projects: ${plan.changed.typecheckProjects.join(", ") || "none"}`,
  );
  console.log(`Batch required: ${plan.batchRequired ? "yes" : "no"}`);
  for (const reason of plan.batchReasons) {
    console.log(`- ${reason}`);
  }
};

const normalizeSelectedFiles = (files) =>
  files?.map((file) => {
    const normalized = path.normalize(file);
    if (
      path.isAbsolute(file) ||
      normalized === ".." ||
      normalized.startsWith(`..${path.sep}`)
    ) {
      throw new Error(`--files must stay inside the repository: ${file}`);
    }
    return file.replace(/^\.[/\\]/, "");
  });

const preparePlan = (base, selectedFiles) => {
  const changed = collectChangedFiles(base);
  return {
    base,
    mergeBase: changed.mergeBase,
    ...buildChangedCheckPlan(normalizeSelectedFiles(selectedFiles) ?? changed.files),
  };
};

const runInstantCommand = async (options) => {
  const plan = preparePlan(options.base, options.files);
  const result = await runInstant(plan, plan.mergeBase);
  emitResult(
    {
      tier: "instant",
      base: plan.base,
      mergeBase: plan.mergeBase,
      changedFiles: plan.changedFiles,
      durationMs: result.durationMs,
      targetWarmMs: plan.instant.targetWarmMs,
      targetExceeded: result.durationMs > plan.instant.targetWarmMs,
    },
    options.json,
  );
};

const runChangedCommand = async (options) => {
  const plan = preparePlan(options.base, options.files);
  if (plan.batchRequired) {
    throw new Error(
      `The changed gate stays bounded and will not expand into a slow repo check:\n- ${plan.batchReasons.join("\n- ")}\nRun pnpm check:batch for this change.`,
    );
  }

  mkdirSync(cacheRoot, { recursive: true });
  const startedAt = performance.now();
  const instant = await runInstant(plan, plan.mergeBase);
  const checks = await Promise.all([
    ...lintTasks(plan.changed.lintFiles),
    ...typecheckTasks(plan.changed.typecheckProjects),
  ]);
  const durationMs = Math.round(performance.now() - startedAt);

  emitResult(
    {
      tier: "changed",
      base: plan.base,
      mergeBase: plan.mergeBase,
      changedFiles: plan.changedFiles,
      lintFiles: plan.changed.lintFiles,
      typecheckProjects: plan.changed.typecheckProjects,
      durationMs,
      instantDurationMs: instant.durationMs,
      targetWarmMs: plan.changed.targetWarmMs,
      targetExceeded: durationMs > plan.changed.targetWarmMs,
      checks: checks.map(({ command, durationMs: checkDurationMs }) => ({
        command,
        durationMs: checkDurationMs,
      })),
    },
    options.json,
  );
};

const runBatch = () => {
  const stages = [
    ["pnpm", ["--silent", "run", "repo", "--", "platform", "generated", "check"]],
    ["pnpm", ["typecheck"]],
    ["pnpm", ["lint"]],
    ["pnpm", ["guard:canonical"]],
    ["pnpm", ["test"]],
  ];
  for (const [command, args] of stages) {
    runCommand(command, args);
  }
};

export const registerCheckCommands = (program) => {
  const checkCommand = program
    .command("check")
    .description("Layered local checks that keep the development loop fast");

  checkCommand
    .command("plan")
    .description("Inspect the changed-file check plan without running it")
    .option("--base <ref>", "Git ref used to find committed branch changes", "origin/main")
    .option("--files <paths...>", "Limit an in-between check to explicit repository files")
    .option("--json", "Print stdout-only JSON")
    .action((options) => emitPlan(preparePlan(options.base, options.files), options.json));

  checkCommand
    .command("instant")
    .description("Run diff, JSON, and JavaScript syntax checks; warm target <=1s")
    .option("--base <ref>", "Git ref used to find committed branch changes", "origin/main")
    .option("--files <paths...>", "Limit an in-between check to explicit repository files")
    .option("--json", "Print stdout-only JSON")
    .action(runInstantCommand);

  checkCommand
    .command("changed")
    .description("Run cached lint and affected TypeScript checks; warm target <=5s")
    .option("--base <ref>", "Git ref used to find committed branch changes", "origin/main")
    .option("--files <paths...>", "Limit an in-between check to explicit repository files")
    .option("--json", "Print stdout-only JSON")
    .action(runChangedCommand);

  checkCommand
    .command("batch")
    .description("Run the slower type, lint, guard, and test gate for substantial batches")
    .action(runBatch);
};
