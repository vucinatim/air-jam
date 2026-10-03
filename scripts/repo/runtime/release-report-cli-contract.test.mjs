import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const cli = path.join(root, "scripts/repo/cli.mjs");
const platform = path.join(root, "apps/platform");
const help = (...args) =>
  execFileSync(
    process.execPath,
    [cli, "platform", "operations", "reports", ...args, "--help"],
    { cwd: root, encoding: "utf8" },
  );

test("report operations are discoverable, private, targetable and preview-first", () => {
  const reports = help();
  for (const command of ["list", "inspect", "decide"])
    assert.match(reports, new RegExp(command));
  assert.match(reports, /private contents/u);
  const list = help("list");
  assert.match(list, /metadata only/u);
  for (const flag of ["--status", "--release-id", "--before-id", "--limit"])
    assert.ok(list.includes(flag));
  const inspect = help("inspect");
  assert.match(inspect, /PRIVATE/u);
  assert.match(inspect, /GitHub/u);
  assert.match(inspect, /--before-revision/u);
  const decide = help("decide");
  assert.match(decide, /read-only\s+preview/u);
  assert.match(decide, /not an\s+authorization\s+role/u);
  for (const flag of [
    "--report-id",
    "--expected-revision",
    "--status",
    "--actor",
    "--reason",
    "--idempotency-key",
    "--apply",
  ])
    assert.ok(decide.includes(flag));
  for (const output of [list, inspect, decide]) {
    for (const flag of ["--railway-environment", "--railway-project", "--json"])
      assert.ok(output.includes(flag));
  }
});

test("invalid bounds are rejected without resolving the requested provider target", () => {
  for (const args of [
    ["list", "--limit", "101"],
    ["inspect", "--report-id", "report", "--before-revision", "-1"],
    [
      "decide",
      "--report-id",
      "report",
      "--expected-revision",
      "1.5",
      "--status",
      "reviewed",
      "--actor",
      "operator",
      "--reason",
      "private-input-sentinel",
      "--idempotency-key",
      "decision",
    ],
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        cli,
        "platform",
        "operations",
        "reports",
        ...args,
        "--railway-environment",
        "must-not-resolve",
        "--json",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: "" },
      },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(
      result.stderr,
      /must be an? (?:nonnegative |positive )?integer/u,
    );
    assert.doesNotMatch(
      result.stderr,
      /private-input-sentinel|must-not-resolve/u,
    );
  }
});

test("the adapter reuses domain input contracts, preserves cursor and defaults to preview", () => {
  const script = `
    import assert from 'node:assert/strict';
    import adapter from './scripts/release-report-cli.ts';
    const { parseReleaseReportCliInput: parse } = adapter;
    assert.equal(parse({command:'list'}).limit, 25);
    assert.equal(parse({command:'inspect', reportId:'report', beforeRevision:3}).beforeRevision, 3);
    const decision = {command:'decide', reportId:'report', expectedRevision:0, status:'reviewed', actor:'operator', reason:'private', idempotencyKey:'decision'};
    assert.equal(parse(decision).apply, false);
    assert.equal(parse({...decision, apply:true}).apply, true);
    for (const input of [ {...decision, expectedRevision:-1}, {...decision, status:'invalid'}, {...decision, actor:''}, {...decision, reason:''}, {...decision, idempotencyKey:''}, {...decision, apply:'true'}, {command:'list',limit:0}, {command:'list',limit:101}, {command:'inspect',reportId:'report',beforeRevision:0} ]) assert.throws(() => parse(input));
  `;
  execFileSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", script],
    {
      cwd: platform,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "" },
    },
  );
});

test("malformed adapter input produces structured errors without echoing private fields", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/release-report-cli.ts",
      JSON.stringify({
        command: "decide",
        reason: "private-report-sentinel",
        reporterEmail: "private-email-sentinel",
      }),
    ],
    {
      cwd: platform,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "" },
    },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(JSON.parse(result.stderr), {
    contractVersion: 1,
    error: "invalid_input",
  });
});

test("intake policy is available without a database and status exposes shared capacity", () => {
  const result = execFileSync(
    process.execPath,
    [cli, "platform", "operations", "reports", "policy", "--json"],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "postgres://unused:unused@127.0.0.1:1/unused",
      },
      timeout: 10_000,
    },
  );
  assert.deepEqual(JSON.parse(result), {
    contractVersion: 1,
    command: "policy",
    privacy: "metadata_only",
    result: {
      requestsPerProcessMinute: 240,
      minuteLimit: 120,
      utcDayLimit: 1000,
    },
  });
  const status = help("status");
  assert.match(status, /shared intake usage/u);
  for (const flag of ["--railway-environment", "--railway-project", "--json"])
    assert.ok(status.includes(flag));
});
