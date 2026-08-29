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

test("durable jobs expose one discoverable repo operations surface", () => {
  const operationsHelp = readHelp("platform", "operations");
  const jobsHelp = readHelp("platform", "operations", "jobs");

  assert.match(operationsHelp, /jobs/u);
  for (const command of [
    "policy",
    "status",
    "list",
    "inspect",
    "cancel",
    "replay",
    "repair-expired",
  ]) {
    assert.match(jobsHelp, new RegExp(command, "u"));
  }
});

test("durable job reads expose bounded stable JSON controls", () => {
  const policyHelp = readHelp("platform", "operations", "jobs", "policy");
  const statusHelp = readHelp("platform", "operations", "jobs", "status");
  const listHelp = readHelp("platform", "operations", "jobs", "list");
  const inspectHelp = readHelp("platform", "operations", "jobs", "inspect");

  assert.match(policyHelp, /--kind/u);
  assert.match(policyHelp, /--json/u);
  assert.doesNotMatch(policyHelp, /--apply/u);
  assert.match(statusHelp, /--kind/u);
  assert.match(statusHelp, /--json/u);
  assert.match(statusHelp, /--railway-environment/u);
  assert.match(listHelp, /--status/u);
  assert.match(listHelp, /--creator/u);
  assert.match(listHelp, /--release/u);
  assert.match(listHelp, /--limit/u);
  assert.match(listHelp, /--json/u);
  assert.match(inspectHelp, /--job/u);
  assert.match(inspectHelp, /--json/u);
});

test("durable job mutations are preview-first and carry required audit fences", () => {
  const cancelHelp = readHelp("platform", "operations", "jobs", "cancel");
  const replayHelp = readHelp("platform", "operations", "jobs", "replay");
  const repairHelp = readHelp(
    "platform",
    "operations",
    "jobs",
    "repair-expired",
  );

  for (const help of [cancelHelp, replayHelp, repairHelp]) {
    assert.match(help, /--apply/u);
    assert.match(help, /read-only\s+preview/u);
    assert.match(help, /--actor/u);
    assert.match(help, /--reason/u);
    assert.match(help, /--json/u);
  }
  assert.match(cancelHelp, /--expected-revision/u);
  assert.match(cancelHelp, /--idempotency-key/u);
  assert.match(replayHelp, /--idempotency-key/u);
  assert.match(repairHelp, /--idempotency-key/u);
  assert.match(repairHelp, /--kind/u);
  assert.match(repairHelp, /--limit/u);
});

test("source-owned job policy is readable as stdout-only JSON without a database", () => {
  const output = execFileSync(
    process.execPath,
    [cliPath, "platform", "operations", "jobs", "policy", "--json"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "",
      },
    },
  );
  const document = JSON.parse(output);

  assert.equal(document.command, "jobs-policy");
  assert.equal(document.applied, false);
  assert.equal(document.result.jobContractVersion, 1);
  assert.deepEqual(
    document.result.policies.map((policy) => policy.kind),
    [
      "release_artifact_processing",
      "release_browser_validation",
      "release_image_moderation",
    ],
  );
  for (const policy of document.result.policies) {
    assert.ok(policy.globalConcurrency > 0);
    assert.ok(policy.queueDepth > 0);
    assert.ok(policy.maxAttempts > 0);
  }
});

const postgresProofUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();

test(
  "operator JSON excludes worker tokens and raw job or event data",
  { skip: !postgresProofUrl },
  async () => {
    const sql = postgres(postgresProofUrl, { max: 1 });
    const suffix = crypto.randomUUID();
    const userId = `cli_redaction_user_${suffix}`;
    const gameId = `cli_redaction_game_${suffix}`;
    const releaseId = `cli_redaction_release_${suffix}`;
    const commandId = `cli_redaction_command_${suffix}`;
    const jobId = `cli_redaction_job_${suffix}`;
    const eventId = `cli_redaction_event_${suffix}`;
    const leaseToken = `lease-secret-${suffix}`;

    try {
      await sql.begin(async (tx) => {
        await tx`insert into users (id, name, email, email_verified, created_at, updated_at)
          values (${userId}, 'CLI redaction proof', ${`${userId}@example.invalid`}, true, now(), now())`;
        await tx`insert into games (id, user_id, name, config)
          values (${gameId}, ${userId}, 'CLI redaction proof', '{}'::jsonb)`;
        await tx`insert into game_releases (id, game_id, source_kind, status)
          values (${releaseId}, ${gameId}, 'upload', 'processing')`;
        await tx`insert into operational_job_commands
          (id, contract_version, idempotency_key, kind, request_hash, actor, reason, request, result, created_at, completed_at)
          values (${commandId}, 1, ${`cli-redaction-command-${suffix}`}, 'enqueue', ${"b".repeat(64)}, 'test:cli-redaction', 'Prove operator-safe JSON.', ${{ authorization: "Bearer command-secret" }}, ${{ job: { id: jobId } }}, now(), now())`;
        await tx`insert into operational_jobs
          (id, contract_version, kind, lane, status, creator_id, game_id, release_id, created_by_command_id, request_hash, correlation_id, payload, progress, priority, available_at, deadline_at, attempt_count, max_attempts, revision, lease_owner, lease_token, lease_expires_at, last_heartbeat_at, started_at, created_at, updated_at)
          values (${jobId}, 1, 'release_artifact_processing', 'release_processing', 'running', ${userId}, ${gameId}, ${releaseId}, ${commandId}, ${"a".repeat(64)}, ${`correlation-${suffix}`}, ${{ authorization: "Bearer payload-secret" }}, ${{ token: "progress-secret" }}, 0, now(), now() + interval '1 hour', 1, 3, 2, 'worker:cli-redaction', ${leaseToken}, now() + interval '5 minutes', now(), now(), now(), now())`;
        await tx`insert into operational_job_events
          (id, job_id, idempotency_key, kind, expected_revision, next_revision, from_status, to_status, attempt, actor, reason, details, correlation_id)
          values (${eventId}, ${jobId}, ${`${jobId}:2:claimed`}, 'claimed', 1, 2, 'queued', 'running', 1, 'worker:cli-redaction', 'Claim redaction proof.', ${{ token: "event-secret" }}, ${`correlation-${suffix}`})`;
      });

      const output = execFileSync(
        process.execPath,
        [
          cliPath,
          "platform",
          "operations",
          "jobs",
          "inspect",
          "--job",
          jobId,
          "--json",
        ],
        {
          cwd: repoRoot,
          encoding: "utf8",
          env: { ...process.env, DATABASE_URL: postgresProofUrl },
        },
      );
      const document = JSON.parse(output);
      const serialized = JSON.stringify(document);
      assert.equal(document.result.job.id, jobId);
      assert.equal(document.result.job.privateData.hasPayload, true);
      for (const secret of [
        leaseToken,
        "Bearer command-secret",
        "Bearer payload-secret",
        "progress-secret",
        "event-secret",
        '"leaseToken"',
        '"requestHash"',
        '"payload"',
        '"details"',
      ]) {
        assert.doesNotMatch(serialized, new RegExp(secret, "u"));
      }

      const cancellationPreview = JSON.parse(
        execFileSync(
          process.execPath,
          [
            cliPath,
            "platform",
            "operations",
            "jobs",
            "cancel",
            "--job",
            jobId,
            "--expected-revision",
            "2",
            "--actor",
            "test:cli-preview",
            "--reason",
            "Prove cancellation preview uses shared authority.",
            "--idempotency-key",
            `cli-preview-${suffix}`,
            "--json",
          ],
          {
            cwd: repoRoot,
            encoding: "utf8",
            env: { ...process.env, DATABASE_URL: postgresProofUrl },
          },
        ),
      );
      assert.equal(cancellationPreview.applied, false);
      assert.equal(cancellationPreview.result.eligible, true);
      assert.equal(cancellationPreview.result.wouldReplay, false);
      assert.equal(cancellationPreview.result.nextStatus, "cancel_requested");
      assert.doesNotMatch(JSON.stringify(cancellationPreview), /leaseToken/u);
      assert.doesNotMatch(JSON.stringify(cancellationPreview), /requestHash/u);
    } finally {
      await sql`delete from games where id = ${gameId}`;
      await sql`delete from operational_job_commands where id = ${commandId}`;
      await sql`delete from users where id = ${userId}`;
      await sql.end();
    }
  },
);
