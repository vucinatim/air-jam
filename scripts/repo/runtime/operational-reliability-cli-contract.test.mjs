import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

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

test("operational reliability is fully discoverable through the repo CLI", () => {
  const reliability = readHelp("platform", "operations", "reliability");
  const events = readHelp("platform", "operations", "reliability", "events");
  const synthetics = readHelp(
    "platform",
    "operations",
    "reliability",
    "synthetics",
  );
  const alerts = readHelp("platform", "operations", "reliability", "alerts");
  const issues = readHelp("platform", "operations", "reliability", "issues");

  for (const command of [
    "catalog",
    "status",
    "retention",
    "events",
    "synthetics",
    "alerts",
  ]) {
    assert.match(reliability, new RegExp(command, "u"));
  }
  for (const command of [
    "status",
    "list",
    "inspect",
    "deliver-once",
    "repair-expired",
    "requeue-dead-letter",
  ]) {
    assert.match(events, new RegExp(command, "u"));
  }
  for (const command of ["run", "run-due", "list"]) {
    assert.match(synthetics, new RegExp(command, "u"));
  }
  for (const command of ["list", "inspect"]) {
    assert.match(alerts, new RegExp(command, "u"));
  }
  for (const command of [
    "status",
    "list",
    "inspect",
    "project-once",
    "repair-expired",
    "requeue-dead-letter",
  ]) {
    assert.match(issues, new RegExp(command, "u"));
  }
});

test("reliability mutations are preview-first and carry explicit audit fences", () => {
  const requeue = readHelp(
    "platform",
    "operations",
    "reliability",
    "events",
    "requeue-dead-letter",
  );
  const synthetic = readHelp(
    "platform",
    "operations",
    "reliability",
    "synthetics",
    "run",
  );
  const issueProjection = readHelp(
    "platform",
    "operations",
    "reliability",
    "issues",
    "project-once",
  );
  const issueRequeue = readHelp(
    "platform",
    "operations",
    "reliability",
    "issues",
    "requeue-dead-letter",
  );
  for (const help of [requeue, synthetic, issueRequeue]) {
    assert.match(help, /--apply/u);
    assert.match(help, /read-only\s+preview/u);
    assert.match(help, /--actor/u);
    assert.match(help, /--reason/u);
    assert.match(help, /--idempotency-key/u);
    assert.match(help, /--json/u);
  }
  assert.match(requeue, /--max-attempts/u);
  assert.match(requeue, /--event/u);
  assert.match(synthetic, /--check/u);
  assert.match(issueProjection, /--apply/u);
  assert.match(issueProjection, /read-only\s+preview/u);
  assert.match(issueProjection, /--worker/u);
  assert.match(issueProjection, /--json/u);
  assert.match(issueRequeue, /--repository/u);
  assert.match(issueRequeue, /--alert-key/u);
});

test("source-owned reliability policy is stdout-only JSON without a database", () => {
  const output = execFileSync(
    process.execPath,
    [cliPath, "platform", "operations", "reliability", "catalog", "--json"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "" },
    },
  );
  const catalog = JSON.parse(output);
  assert.equal(catalog.contractVersion, 1);
  assert.equal(catalog.checks.length, 6);
  assert.equal(catalog.slos.length, 4);
  assert.deepEqual(catalog.checks.map((check) => check.story).sort(), [
    "arcade_hosted_release",
    "landing_docs",
    "platform_realtime_health",
    "release_dependencies",
    "room_controller",
    "semantic_gameplay",
  ]);
});

const postgresProofUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();

test("evidence retention is preview-first, per-table bounded, and exactly targetable", () => {
  const help = readHelp("platform", "operations", "reliability", "retention");
  assert.match(help, /--apply/u);
  assert.match(help, /read-only\s+preview/u);
  assert.match(help, /per table/u);
  assert.match(help, /1 to 1000/u);
  assert.match(help, /default: "200"/u);
  assert.match(help, /--cursor <cursor>/u);
  assert.match(help, /nextCursor/u);
  assert.match(help, /--json/u);
  assert.match(help, /--railway-environment/u);
  assert.match(help, /--railway-project/u);
});

test("retention rejects invalid bounds before database or provider resolution", () => {
  for (const limit of ["0", "1001", "1.5", "not-a-number"]) {
    const result = spawnSync(
      process.execPath,
      [
        cliPath,
        "platform",
        "operations",
        "reliability",
        "retention",
        "--limit",
        limit,
        "--railway-environment",
        "must-not-be-resolved",
        "--json",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: "" },
      },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /limit must be an integer from 1 to 1000/u);
    assert.equal(result.stdout, "");
  }
});

test(
  "retention forwards preview defaults and explicit bounded apply to the shared service",
  { skip: !postgresProofUrl },
  () => {
    const run = (...args) =>
      JSON.parse(
        execFileSync(
          process.execPath,
          [
            cliPath,
            "platform",
            "operations",
            "reliability",
            "retention",
            "--json",
            ...args,
          ],
          {
            cwd: repoRoot,
            encoding: "utf8",
            env: { ...process.env, DATABASE_URL: postgresProofUrl },
          },
        ),
      );
    const preview = run();
    const applied = run("--apply", "--limit", "1");
    if (applied.result.nextCursor) {
      const continued = run(
        "--cursor",
        applied.result.nextCursor,
        "--limit",
        "1",
      );
      assert.equal(continued.result.mode, "preview");
      assert.equal(continued.result.limit, 1);
    }
    for (const [document, mode, limit] of [
      [preview, "preview", 200],
      [applied, "apply", 1],
    ]) {
      assert.equal(document.contractVersion, 1);
      assert.equal(document.command, "retention");
      assert.equal(document.applied, mode === "apply");
      assert.equal(document.result.contractVersion, 1);
      assert.equal(document.result.mode, mode);
      assert.equal(document.result.limit, limit);
      assert.ok(
        document.result.nextCursor === null ||
          typeof document.result.nextCursor === "string",
      );
      assert.ok(
        Number.isInteger(document.result.blockedCandidates) &&
          document.result.blockedCandidates >= 0,
      );
      for (const key of ["evaluatedAt", "historyCutoff", "commandCutoff"]) {
        assert.ok(Number.isFinite(Date.parse(document.result[key])));
      }
      assert.deepEqual(
        Object.keys(document.result.counts).sort(),
        ["commands", "evaluations", "syntheticRuns", "outbox", "events"].sort(),
      );
      for (const count of Object.values(document.result.counts)) {
        assert.ok(Number.isInteger(count) && count >= 0 && count <= limit);
      }
    }
  },
);

test(
  "event inspection and repair preview redact payloads, failure details, and leases",
  { skip: !postgresProofUrl },
  async () => {
    const sql = postgres(postgresProofUrl, { max: 1 });
    const suffix = crypto.randomUUID();
    const eventId = `cli-reliability:${suffix}`;
    const payloadSecret = `payload-secret-${suffix}`;
    const failureSecret = `failure-secret-${suffix}`;
    const leaseSecret = `lease-secret-${suffix}`;
    const at = new Date("2020-01-01T00:00:00.000Z").toISOString();
    const envelope = {
      contractVersion: 1,
      plane: "lifecycle_runtime",
      eventId,
      kind: "test.cli_failure",
      severity: "error",
      outcome: "failed",
      authority: "airjam_authoritative",
      source: {
        service: "operational_worker",
        component: "cli-redaction-test",
        environment: "test",
      },
      subject: { type: "service", id: "operational_worker" },
      correlation: { contractVersion: 1, correlationId: eventId },
      occurredAt: at,
      observedAt: at,
      payload: { diagnostic: payloadSecret },
      evidence: [],
    };
    try {
      await sql`
        insert into operational_event_outbox
          (id, contract_version, envelope, status, attempt_count, max_attempts,
           available_at, last_error, created_at, updated_at)
        values
          (${eventId}, 1, ${sql.json(envelope)}, 'dead_letter', 2, 2,
           ${at}, ${sql.json({
             contractVersion: 1,
             code: "test.failure",
             class: "internal",
             summary: "A redacted test failure.",
             retryable: false,
             details: { diagnostic: failureSecret, leaseToken: leaseSecret },
           })}, ${at}, ${at})
      `;
      const run = (...args) =>
        execFileSync(process.execPath, [cliPath, ...args], {
          cwd: repoRoot,
          encoding: "utf8",
          env: { ...process.env, DATABASE_URL: postgresProofUrl },
        });
      const inspected = JSON.parse(
        run(
          "platform",
          "operations",
          "reliability",
          "events",
          "inspect",
          "--event",
          eventId,
          "--json",
        ),
      );
      const preview = JSON.parse(
        run(
          "platform",
          "operations",
          "reliability",
          "events",
          "requeue-dead-letter",
          "--event",
          eventId,
          "--actor",
          "agent:cli-proof",
          "--reason",
          "Prove the safe repair preview.",
          "--idempotency-key",
          `cli-requeue:${suffix}`,
          "--json",
        ),
      );
      assert.equal(inspected.result.status, "dead_letter");
      assert.deepEqual(inspected.result.event.payloadKeys, ["diagnostic"]);
      assert.equal(preview.applied, false);
      assert.equal(preview.result.eligible, true);
      const serialized = JSON.stringify({ inspected, preview });
      for (const secret of [payloadSecret, failureSecret, leaseSecret]) {
        assert.doesNotMatch(serialized, new RegExp(secret, "u"));
      }
      assert.doesNotMatch(serialized, /leaseToken/u);
      assert.doesNotMatch(serialized, /lastError.*details/u);
    } finally {
      await sql`delete from operational_event_delivery_commands where event_id = ${eventId}`;
      await sql`delete from operational_events where id = ${eventId}`;
      await sql`delete from operational_event_outbox where id = ${eventId}`;
      await sql.end();
    }
  },
);

test(
  "GitHub issue projection reads and preview are database-backed and secret-free",
  { skip: !postgresProofUrl },
  () => {
    const privateKey = "github-private-key-must-not-print";
    const run = (...args) =>
      execFileSync(process.execPath, [cliPath, ...args], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_URL: postgresProofUrl,
          AIRJAM_GITHUB_ISSUES_APP_ID: "123",
          AIRJAM_GITHUB_ISSUES_INSTALLATION_ID: "456",
          AIRJAM_GITHUB_ISSUES_PRIVATE_KEY: privateKey,
          AIRJAM_GITHUB_ISSUES_REPOSITORY: "vucinatim/air-jam",
        },
      });
    const status = JSON.parse(
      run(
        "platform",
        "operations",
        "reliability",
        "issues",
        "status",
        "--repository",
        "vucinatim/air-jam",
        "--json",
      ),
    );
    assert.equal(status.command, "issues-status");
    assert.equal(status.result.repository, "vucinatim/air-jam");

    const previewText = run(
      "platform",
      "operations",
      "reliability",
      "issues",
      "project-once",
      "--worker",
      "agent:cli-proof",
      "--json",
    );
    const preview = JSON.parse(previewText);
    assert.deepEqual(preview.result, {
      applied: false,
      operation: "project one dependency-ready alert to GitHub",
      configured: true,
      repository: "vucinatim/air-jam",
      workerId: "agent:cli-proof",
    });
    assert.doesNotMatch(previewText, new RegExp(privateKey, "u"));
    assert.doesNotMatch(previewText, /installation-token|privateKey|appId/u);
  },
);
