import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

test("PRs retain fast checks and share one workspace build behind checks", () => {
  const workflow = YAML.parse(
    fs.readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8"),
  );
  const lanes = workflow.jobs.validate.strategy.matrix.include;
  assert.deepEqual(
    lanes.map(({ name }) => name),
    ["Static contracts", "Workspace build and types"],
  );
  assert.match(lanes[0].command, /ai-pack:check.*pnpm lint.*guard:canonical/u);
  assert.equal(lanes[1].command, "pnpm build && pnpm -r typecheck");
  const archive = workflow.jobs.validate.steps.find((step) =>
    step.run?.startsWith("tar -czf"),
  );
  assert.match(archive.run, /packages\/\*\/dist/u);
  assert.match(archive.run, /packages\/cli\/template-assets\/documentation/u);
  assert.equal(workflow.jobs.tests.needs, "validate");
  assert.match(
    workflow.jobs.tests.steps.at(-1).run,
    /check tests --tier fast/u,
  );
  assert.ok(
    workflow.jobs.tests.steps.some(
      (step) => step.with?.name === "workspace-build",
    ),
  );
  assert.equal(workflow.jobs.checks.name, "checks");
  assert.deepEqual(workflow.jobs.checks.needs, ["validate", "tests", "slow"]);
  assert.equal(workflow.jobs.checks.if, "always()");
  const verdict = workflow.jobs.checks.steps[0].run;
  assert.match(verdict, /test "\$VALIDATION_RESULT" = success/u);
  assert.match(verdict, /test "\$TEST_RESULT" = success/u);
  assert.match(verdict, /test "\$SLOW_RESULT" = skipped/u);
  assert.match(verdict, /test "\$SLOW_RESULT" = success/u);
  for (const job of [
    workflow.jobs.validate,
    workflow.jobs.tests,
    workflow.jobs.checks,
  ]) {
    assert.ok(job["timeout-minutes"] <= 5);
  }
});

test("nightly and manual CI preserve process, package and performance coverage", () => {
  const workflow = YAML.parse(
    fs.readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8"),
  );
  assert.ok(workflow.on.schedule.length > 0);
  assert.ok(workflow.on.workflow_dispatch !== undefined);
  assert.ok(workflow.on.pull_request !== undefined);
  assert.equal(workflow.on.push, undefined);
  assert.equal(workflow.concurrency["cancel-in-progress"], true);
  assert.equal(workflow.jobs.slow.if, "github.event_name != 'pull_request'");
  const lanes = workflow.jobs.slow.strategy.matrix.include;
  assert.deepEqual(
    lanes.map(({ name }) => name),
    [
      "Slow tool tests",
      "Slow runtime and repository tests",
      "Standalone packages",
      "Performance smoke",
    ],
  );
  assert.match(lanes[0].command, /--tier slow --project devtools/u);
  assert.match(
    lanes[1].command,
    /--project repo cli mcp-server create-airjam server sdk/u,
  );
  assert.match(lanes[2].command, /pack verify-local --json/u);
  assert.match(lanes[3].command, /perf sanity --profile ci/u);
  const upload = workflow.jobs.slow.steps.find(
    (step) => step.with?.name === "foundation-packages",
  );
  assert.equal(upload.if, "matrix.name == 'Standalone packages'");
  assert.equal(upload.with["if-no-files-found"], "error");
  for (const job of [workflow.jobs.validate, workflow.jobs.slow]) {
    assert.match(job.steps[0].with.ref, /schedule.*release\/1\.0/u);
  }
});

test("the canonical guard has no external ripgrep runtime dependency", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "scripts/repo/commands/standards.mjs"),
    "utf8",
  );
  const workflow = fs.readFileSync(
    path.join(repoRoot, ".github/workflows/ci.yml"),
    "utf8",
  );

  assert.doesNotMatch(source, /runCommandResult\("rg"/u);
  assert.doesNotMatch(workflow, /Install ripgrep|apt-get install -y ripgrep/u);
});

test("PR candidate archives remain available without running release processes", () => {
  const installation = YAML.parse(
    fs.readFileSync(
      path.join(repoRoot, ".github/workflows/public-install-matrix.yml"),
      "utf8",
    ),
  );
  const publication = YAML.parse(
    fs.readFileSync(
      path.join(repoRoot, ".github/workflows/publish-packages.yml"),
      "utf8",
    ),
  );
  assert.ok(installation.on.schedule.length > 0);
  assert.equal(
    installation.jobs.verify.if,
    "github.event_name != 'pull_request'",
  );
  assert.equal(installation.jobs.candidate["timeout-minutes"], 5);
  const steps = installation.jobs.candidate.steps;
  assert.ok(
    steps.some((step) => step.with?.name === "public-release-candidate"),
  );
  const gate = steps.find((step) => step.run === "pnpm check:release:publish");
  assert.equal(gate.if, "github.event_name != 'pull_request'");
  const releaseGate = publication.jobs.candidate.steps.find(
    (step) => step.run === "pnpm check:release:publish",
  );
  assert.ok(releaseGate);
  assert.equal(releaseGate.if, undefined);
  const source = fs.readFileSync(
    path.join(repoRoot, "scripts/repo/lib/public-release-candidate.mjs"),
    "utf8",
  );
  assert.doesNotMatch(source, /check:release:publish/);
});

test("scheduled installation qualifies one release commit despite a different event SHA", () => {
  const { jobs } = YAML.parse(
    fs.readFileSync(
      path.join(repoRoot, ".github/workflows/public-install-matrix.yml"),
      "utf8",
    ),
  );
  const checkout = jobs.candidate.steps[0];
  assert.equal(checkout.id, "source");
  assert.equal(
    checkout.with.ref,
    "${{ github.event_name == 'schedule' && 'release/1.0' || github.sha }}",
  );
  assert.equal(
    jobs.candidate.outputs.commit,
    "${{ steps.source.outputs.commit }}",
  );
  const create = jobs.candidate.steps.find((step) =>
    step.run?.includes("release candidate create"),
  );
  assert.equal(create.env.SOURCE_COMMIT, "${{ steps.source.outputs.commit }}");
  assert.match(create.run, /^GITHUB_SHA="\$SOURCE_COMMIT" pnpm /u);
  assert.equal(jobs.verify.needs, "candidate");
  assert.deepEqual(jobs.aggregate.needs, ["candidate", "verify"]);
  for (const job of [jobs.verify, jobs.aggregate]) {
    assert.equal(
      job.steps[0].with.ref,
      "${{ needs.candidate.outputs.commit }}",
    );
  }
  const verify = jobs.verify.steps.find((step) =>
    step.run?.includes("release install-matrix verify"),
  );
  assert.equal(verify.shell, "bash");
  assert.equal(
    verify.env.SOURCE_COMMIT,
    "${{ needs.candidate.outputs.commit }}",
  );
  assert.match(verify.run, /^GITHUB_SHA="\$SOURCE_COMMIT" pnpm /u);
});
