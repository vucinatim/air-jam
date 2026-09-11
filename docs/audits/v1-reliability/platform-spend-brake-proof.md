# Platform spend-brake admission proof

Date: 2026-09-11. Scope: G3-02 platform admission, local source and isolated PostgreSQL
proof only. This is not production rollout or provider-cost evidence.

## Boundary

The platform now uses the existing shared operational admission policy and
authority snapshot for release submission, artifact upload/finalization, media
upload, game creation, new Arcade listings, and worker claims. There is no new budget model, queue, table, scheduler,
or caller-controlled bypass.

In production, expensive admissions require fresh budget evidence. Missing
cycle, missing evidence, and stale evidence deny admission with
`control_unavailable`. Configured spend thresholds deny affected lanes with
`budget_protection`; explicit pauses remain `lane_paused`. Thresholds and
freshness stay owned by the shared database contract, not duplicated here.
Development and preview retain the existing `not_applicable` budget policy.

Worker claims read that policy while holding the existing lane lock and using
the transaction's database authority clock. Denial returns no claimed job and
does not consume an attempt. An allowed claim retains all existing queue,
creator-concurrency, lease, deadline, and fairness rules.

Actual database/policy failures are not quiet budget denials: the decision
reader propagates them to the worker's existing failure-reporting path. The
public admission assertion retains the original error as its cause while
returning the typed unavailable-admission error. Missing/stale evidence remains
an ordinary denied decision, distinct from a failed authority read.

Enqueue and operator replay deliberately remain bounded durable bookkeeping.
Running artifact/browser phases must atomically save their output, enqueue the
successor, and finish even if cost protection activates during execution.
Rejecting that enqueue would roll back useful completed work. Existing queue
depth limits bound this bookkeeping; the successor cannot start until its
claim is allowed. No continuation flag or alternate enqueue API was added.

Cleanup and telemetry still honor their explicit lane pause but do not read or
require budget evidence. Inspection and budget collection are unchanged and
remain available for recovery. Running-job heartbeat, result commit, and
completion are not retroactively revoked by the spending brake.

Fresh evidence automatically restores budget-denied work when its spend state
permits that lane; an explicit pause must still be lifted explicitly. The brake
does not stop all infrastructure billing or cancel already-running work.

Dashboard and machine game creation now share one domain operation: normalize
metadata, check `game_creation`, and commit the hidden game and its App ID in
one transaction. Neither adapter can leave an unusable half-created game.
Listing admission applies only when changing a hidden game to listed; ownership
and the live-release prerequisite remain enforced. Unlisting and ordinary edits
to existing games do not become new cost admissions. HTTP and machine adapters
retain their existing structured denial mapping.

One listing-admission service owns the visibility transition, live-release
prerequisite, and validation message for both adapters. One recovery-lane
constant owns both budget exemptions and the emergency command's excluded
scope; those policy lists cannot drift independently.

## Emergency operator path

`platform operations emergency-pause` is a preview-first command that pauses
the eleven expensive lanes in one database transaction. It reuses the same
per-lane locks, optimistic setter, and audit events as `lane set`; no global
flag, new table, or parallel mutation model was added. Its fixed scope excludes
cleanup and telemetry. Each receipt retains original previous/applied states
and separately reports current state, so retrying an old command cannot undo
a subsequent selective recovery.

The [actual CLI drill](./evidence/g3-02-20260911/emergency-cli.json) proved
read-only preview, all eleven paused lanes, unchanged recovery lanes, selective
recovery through `lane set`, and replay without re-pausing. An already-used key's
preview truthfully reports `wouldApply: false`. The drill finished by restoring
all thirteen lanes to normal through explicit per-lane commands, retaining the
audit events in the isolated database. The
[canonical control contract](../../contracts/production-control-contract.md#agent-operable-surface)
documents inspection, pause, replay, and recovery.

## Retained local proof

- Created only `airjam_spend_brake_20260911` on the existing loopback PostgreSQL
  instance `127.0.0.1:55432`. Existing live-dev and production databases were
  not modified. This test database is retained for integration.
- Applied the existing `apps/platform/drizzle` catalog with the same Drizzle
  migrator used by preview boot. No production migration-plan workflow was
  needed for this empty, disposable test fixture.
- Canonical `platform database migration inspect --json`: `ready`, compatible,
  40 applied migrations, head `0039_realtime_admission_contract`, no pending or
  unknown migrations. Catalog digest:
  `1857f4746a6ce83165ee391dd84c5d854a52a913882c18f4e29292fcd8071a09`.
- Control unit tests cover shared lane thresholds, truthful error reasons,
  missing/stale evidence, production versus preview/local applicability, and
  cleanup/telemetry independence with explicit pauses preserved.
- PostgreSQL jobs proof covers missing cycle/evidence, stale evidence,
  near-ceiling denial, fresh-evidence recovery, ceiling protection during an
  active job, its completion and queued successor, idempotent enqueue replay,
  and first-attempt successor execution after recovery.
- Existing job concurrency, fairness, lease fencing, post-lock database clock,
  pause, retry, cancellation, and replay tests remain green.
- Integrated final control/creation/release suite: 95 tests passed across ten
  files in 18.96 seconds, with database-mutating files explicitly serialized.
  Emergency PostgreSQL cases cover concurrent identical commands, conflicting
  intent, incomplete receipts, all-lane rollback on a later audit-write failure,
  and recovery without duplicate mutations.
- `pnpm check:batch` passed after integration: generated-source checks, full
  typechecking, lint, canonical guard, and repository/package/platform suites.
  The platform suite reported 475 passing and 70 database-gated skipped tests;
  those skips do not substitute for the separate 95-test database integration.
- One Canonicalizer session `9cd965d8-0fab-48ca-8437-736efa03713a` reached
  `ready` after consolidating the listing rule and recovery-lane list. Affected
  follow-up checks passed: 39 creation/listing/adapter tests, 27 control and
  emergency tests, explicit test-root TypeScript, and platform lint. Scoped
  changed gate passed in 7.653 seconds, above its 5-second warm target. The full
  batch was not needlessly repeated for these focused review corrections.
- Shared creation and adapter tests: 30 passed, covering normalization,
  denial without writes, ownership, visibility transitions, live-release
  requirements, and structured errors.
- Real PostgreSQL creation proof: two tests passed. A genuine `app_ids_pkey`
  collision rejects the second insert and rolls back the new game, while the
  existing game and App ID remain intact. No schema changes were needed.
- Focused run: 47 tests passed across control unit, control PostgreSQL, job
  PostgreSQL, and release application tests. Source changed gate passed in
  8.95 seconds (above the 5-second warm target; not claimed as a warm run).
- Explicit TypeScript program including both changed test files: zero
  diagnostics. The existing cleanup-storage test double was completed with
  its missing `listObjects` and `deleteObjects` methods; prefix cleanup must
  not call either method.

To repeat against the retained fixture without printing credentials or editing
environment files:

```sh
node --env-file=.env.local --input-type=module <<'NODE'
import { spawnSync } from 'node:child_process';
const target = new URL(process.env.DATABASE_URL);
if (target.hostname !== '127.0.0.1' || target.port !== '55432') {
  throw new Error('Not the approved local test instance');
}
target.pathname = '/airjam_spend_brake_20260911';
const env = {
  ...process.env,
  DATABASE_URL: target.toString(),
  AIR_JAM_TEST_DATABASE_URL: target.toString(),
  AIRJAM_OPERATIONAL_ENVIRONMENT: 'test',
  RAILWAY_ENVIRONMENT_NAME: '',
};
const result = spawnSync('pnpm', [
  '--filter', 'platform', 'exec', 'vitest', 'run', '--no-file-parallelism',
  'src/server/operations/production-control-service.test.ts',
  'src/server/operations/production-control-service.postgres.test.ts',
  'src/server/operations/emergency-pause-service.test.ts',
  'src/server/operations/emergency-pause-service.postgres.test.ts',
  'src/server/jobs/operational-job-service.postgres.test.ts',
  'src/server/games/game-creation-service.test.ts',
  'src/server/games/game-creation-service.postgres.test.ts',
  'src/server/games/machine-game.test.ts',
  'src/server/api/routers/game-create.test.ts',
  'src/server/releases/release-application-service.test.ts',
], { env, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
NODE
```

## Remaining release evidence

Before production rollout, confirm the existing budget collector supplies a
fresh authoritative sample and active budget cycle. Otherwise expensive
production admissions intentionally fail closed. Provider-cost accuracy,
collector availability, real deployment behavior, and emergency operator drills
are not proven by this local fixture.

Additional per-creator quota integration remains outside this phase; the new
creation/listing checks enforce existing lane and spend authority, not new
allowances. The practical spend brake and emergency command are locally proven;
this does not claim the final production candidate or public release ready.
Measured load remains `G3-04`/`G3-05`; production collector and worker observation
and the exact-candidate emergency drill remain `G3-08`/`G7-03`.
