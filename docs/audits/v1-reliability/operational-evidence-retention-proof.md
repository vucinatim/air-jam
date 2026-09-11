# Operational evidence retention proof

Date: 2026-09-12 (local; execution began 2026-09-11 UTC)
Scope: local `G3-07` implementation; no production deletion or rollout

## Policy and boundary

The maintainer approved 30 days of routine completed history and 90 days of
completed command receipts, with unresolved-incident evidence protected.
The [operational reliability contract](../../contracts/operational-reliability-contract.md#operational-evidence-retention)
owns the behavior and CLI. No tables, provider integration, separate scheduler,
or generic remediation engine were added.

The existing worker and repo CLI share one retention service. A short shared /
exclusive database fence protects persisted references; synthetic network work
is outside that fence. Alert and issue identities are never cleanup targets.

## Isolated database proof

Tests use the dedicated local PostgreSQL database
`airjam_retention_20260911` on loopback port `55432`, separate from normal local
development and production. Credentials are not part of these artifacts.

The focused PostgreSQL suite exercises:

- preview purity, apply counts, 30/90-day cutoffs, repeated bounded batches,
  and old events with recent delivery
- transitive evidence links and pending, leased, and dead-letter work
- deletion of expired self-referencing event/receipt groups without dangling
  references; an oversized group remains intact and is reported
- latest SLO state and its samples, open incidents, and stale issue targets
  after internal recovery
- completed versus unfinished command receipts and their audit events
- a real concurrent writer: cleanup waits, then sees the committed reference
- cursor progress past both an old open incident and arbitrary retained links;
  invalid cursors are rejected rather than interpreted as SQL
- a backlog-sized batch, with timing retained below

Existing event delivery and GitHub projection PostgreSQL lifecycle suites also
exercise the writer-fence integration. Worker tests cover failure visibility,
recovery, non-overlap, oversized-candidate warnings, and drain. Repo CLI tests
cover help, bounds, target options, and preview/apply forwarding.

Result: **22 PostgreSQL tests passed** (11 retention, 5 reliability, 3 issue
projection, 3 realtime publisher). All 8 repo CLI tests passed with PostgreSQL
enabled, including cursor forwarding. The worker's 11 focused tests and 12 migration/shared-schema
contract tests passed. Full `pnpm check:batch` passed before the final query
and cursor optimization; the changed-source TypeScript/lint gate passed after
that rewrite. Its five-file cross-project run took 10.98 seconds, over the
five-second warm target; this is recorded, not described as a sub-five-second
check. The ordinary development gate does not run the large database fixture.

## Month-sized performance proof

The synthetic catalog schedules seven checks per minute: about 302,400 per
30-day month. The isolated fixture held **300,000 rows each** in synthetic runs,
evaluations, delivered outbox, and stored events (1.2 million rows total),
including 1,000 expired bundles and 299,000 recent bundles per table.

The initial collector expanded references across the whole history. Although
it passed correctness tests and small batches, it exceeded the real five-second
statement timeout at month volume. A diagnostic plan also exceeded 30 seconds.
That implementation was replaced; the timeout was not increased to hide the
problem.

The replacement uses indexed old candidate pages and incoming-reference
lookups, plus the existing SLO/incident authorities. All 16 indexes in migration
`0040` were present for the measurements. The actual shared service, with its
ordinary two-second lock / five-second statement limits, returned:

| Operation                                      | Local wall time | Deleted/selected rows per table                            |
| ---------------------------------------------- | --------------: | ---------------------------------------------------------- |
| Preview, limit 1,000                           |          684 ms | 500 each: runs, evaluations, outbox, events; zero commands |
| Apply, limit 1,000                             |          696 ms | Same 500 per table, atomically deleted                     |
| Apply, 5,000 mirrored-event backlog, limit 200 |          315 ms | 200 outbox + 200 stored events                             |

Overlap accounting is intentionally conservative, so a synthetic bundle can
consume more than one candidate slot. The measured 500 bundles per worker tick
still exceeds the normal 105 arrivals per 15-minute interval. This is local
database throughput evidence, not a promise about production latency or
arbitrary high-fanout incident graphs. Long-lived incident evidence may remain
beyond 30 days by policy. Oversized groups are retained and reported; query
timeouts roll back and remain visible through worker health.

The performance fixture used direct isolated index setup while iterating; that
does not stand in for the canonical production migration lifecycle. The unused
`airjam_retention_correctness_20260912` clone is also isolated and contains no
new production evidence. No normal development or production data was deleted.

## Full-document follow-up and index-buffer diagnosis

The checked-in opt-in fixture uses full canonical documents and inserts into
already-existing indexes. Setup completed in about 67 seconds, but the actual
collector preview exceeded its five-second statement timeout. The earlier
684/696 ms numbers used compact documents and indexes built after seeding; they
are not sufficient closure evidence. `G3-07` was reopened pending this query
investigation. No timeout increase or production activation was made.

After resetting only the repeatedly reused disposable fixture, a fresh
full-document seed reproduced the problem. Diagnostic `EXPLAIN` exceeded 30
seconds. Clearing only the four GIN pending lists removed 150 pages from the
stored-event index and 150 from the evaluation index (zero from the other two).
The same service/query/rows then returned a preview in **1,020 ms**, selecting
250 bundles. No vacuum or planner change was involved. This isolates pending
index updates as the observed bottleneck, not the retention policy.

The four evidence-array indexes therefore use `fastupdate=off` in the final
unpublished `0040` migration. At seven synthetic arrivals per minute, direct
index maintenance is a justified tradeoff for reliable incoming-reference
lookups. The opt-in test inserts into existing indexes to cover this condition;
an index build after seeding is not sufficient proof.

The final checked-in opt-in test **passed** after fresh inserts into indexes
configured with `fastupdate=false`: preview **2,263 ms**, apply **670 ms**,
250 rows deleted from each of runs/evaluations/outbox/events, zero commands,
and **all 299,000 recent runs retained**. Setup and execution took 78.7 seconds;
the collector's five-second limit was unchanged. This full-document result is
the authoritative scale evidence; the earlier compact benchmark is retained
only to explain the investigation. The exact-table fixture cleanup completed.

Reproduce the staged proof with an explicitly prepared, disposable PostgreSQL
test database at schema `0040`. Export `AIR_JAM_TEST_DATABASE_URL` (and the same
`DATABASE_URL`) through the local secret environment, then run:

```bash
AIR_JAM_RETENTION_SCALE_PROOF=1 pnpm --filter platform exec vitest run src/server/operations/operational-evidence-retention-service.postgres.test.ts -t 'collects a month'
```

The fixture clears the operational tables in that test database before/after
the test. Never point it at normal development, shared staging, or production
data. Its longer timeout allows setup/teardown only; the service retains its
five-second statement limit. The large test is skipped unless explicitly
enabled, keeping ordinary checks fast.

## Remaining delivery boundary

The final Canonicalizer pass found the architecture appropriately bounded and
requested one ownership cleanup: internal evidence prefixes and retention
limits now live in `@air-jam/operations-contract`, shared by their producers,
collector, worker, and CLI. Twenty operations-contract tests pass, including
continued acceptance of external opaque evidence references. The unused
`evaluation:` evidence convention was removed; actual evaluation links keep
using their existing dedicated fields.

Canonicalizer session `ba0908cb-0c21-49af-97f5-6baa32a2aa62` reached **ready**
after those corrections in the same review session. No second GitHub/Opus
review was invoked locally; that remains the once-per-green-PR merge gate.

This is local implementation evidence, not a claim that production cleanup has
run. Reviewed delivery, exact deployment verification, and sustained worker
observation remain separate release work. Oversized connected evidence groups
are reported for operator inspection; they are never split to meet a row cap.
`0040` creates ordinary transactional indexes, not concurrent/background builds;
table writes may wait during construction. Use the canonical migration plan,
apply, and verify lifecycle before activating the new worker. The existing
index verification checks existence; the immutable DDL and generated snapshot
specify `fastupdate=false`, and the isolated fixture verifies its runtime effect.
