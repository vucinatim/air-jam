import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  const alerts = readHelp(
    "platform",
    "operations",
    "reliability",
    "alerts",
  );
  const issues = readHelp(
    "platform",
    "operations",
    "reliability",
    "issues",
  );

  for (const command of [
    "catalog",
    "status",
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
