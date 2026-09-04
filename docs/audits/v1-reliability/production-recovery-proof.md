# Production Recovery Proof

Last updated: 2026-09-04
Status: implementation and isolated drill proven; reviewed deployment rollback pending

This evidence record supports readiness item `G3-03`. The
[production recovery contract](../../contracts/production-recovery-contract.md)
owns the durable architecture; this document records what was exercised.

## Current Verdict

The production backup policy, portable database restore, and exact durable-job
replay are implemented and live-proven. The final deployment rollback drill is
deliberately deferred until the implementation has passed the repository's
normal reviewed-merge process and the exact resulting production deployment is
available as the forward recovery target.

No production database row or stored object was mutated during this work.

## Production Backup Policy

The canonical recovery status initially observed zero schedules and one
unexpired manual Railway volume backup. The preview-first schedule operation
then applied and read back exactly:

| Kind    | Provider cron | Provider retention |
| ------- | ------------- | -----------------: |
| Daily   | `22 22 * * *` |    518,400 seconds |
| Weekly  | `11 20 * * 6` |  2,332,800 seconds |
| Monthly | `9 14 1 * *`  |  7,689,600 seconds |

Provider read-back at `2026-09-04T07:00:17.504Z` reported policy `ready: true`.
The applied operation digest was
`0ddbe24ad275f0893c1e199236eef3378c88809661c83e2a9c4fd39738618d12`;
its owner-only evidence document had SHA-256
`21a4f47e61a81db0485ec8bd216892fe87e776a7a7d5de4365a5c15677a7137a`.

## Portable Backup

A fresh PostgreSQL 17 production snapshot was captured at
`2026-09-04T06:52:06.673Z` through backup contract version 2.

| Measure                 | Result                                                             |
| ----------------------- | ------------------------------------------------------------------ |
| Schema migrations       | 37                                                                 |
| Database size           | 16,471,731 bytes                                                   |
| Dump size               | 639,192 bytes                                                      |
| Dump SHA-256            | `fe39763b21f4a7dd2c6e16e149b0c3ff21d44551a42f7af6a0049835bc25710e` |
| Table-count digest      | `7bd8d794be153ac263a0c581a681621e878e2b28520e59f9e455c96953572202` |
| Source environment      | Railway production `53607220-1116-4d93-89b2-d508835901ac`          |
| Source database service | `1e47d048-2fec-40b3-ba35-7b4b8cd99888`                             |

The table-count snapshot covered all 40 application and Drizzle relations then
present. `pg_dump` and the counts shared one exported repeatable-read snapshot.

## Isolated Restore Drill

The drill created a blank Railway environment named
`recovery-g3-03-20260904` with a fresh PostgreSQL 18 service and no Air Jam
application service, production credential copy, or object-storage access. A
temporary TCP proxy supplied bounded local operator access.

The immutable restore plan used digest
`555db65869d420fb3960b2e011aaa13abca3bed1306bb960002f1afcf49e4f30`.
Its target environment and database service were respectively
`e5f5dc21-43d4-49b1-8a05-7dfa08447dff` and
`4a6d62cf-505a-41ef-9a5d-500c4d000f49`, both distinct from production.

Apply completed with:

| Measure                     | Result             |
| --------------------------- | ------------------ |
| Status                      | `verified`         |
| Recovery time               | 23,435 ms          |
| Recovery point age at start | 149,345 ms         |
| Migration-head check        | exact match        |
| Every table-count check     | exact digest match |

A separate `verify` invocation at `2026-09-04T06:55:12.455Z` independently
re-read the target and reproduced both checks.

The first plan attempt had also exposed a useful fail-closed boundary: Railway's
private database hostname cannot resolve from a local operator. The resolver
was corrected to use a temporary Railway TCP proxy when no generated public
database URL exists, while keeping credentials out of output. No mutation had
occurred before that failure.

## Exact Durable-Job Replay Drill

Only inside the restored copy, the canonical lifecycle cleanup command created
job `361b84e8-5bff-44ba-b23d-5da9a04a0c87`. The canonical cancellation command
fenced revision `1` and moved it to `canceled` revision `2`. Replay then created
job `fca322f7-9db8-419d-b17c-8d0c3a8f3703`.

The apply result and a separate inspection proved:

1. `replayOfJobId` points to the exact canceled job
2. job kind, creator, game, release, generation, resource kind, resource ID,
   and correlation ID are unchanged
3. the new job has one persisted `replayed` event with the requested actor,
   reason, correlation ID, and lineage detail
4. operator JSON contains redacted job projections rather than raw payloads or
   lease tokens

A deliberate attempt to replay the new `queued` job failed with exit code `1`,
reported `Only failed or canceled jobs can be replayed`, and returned the exact
job, actor, reason, idempotency key, and next inspection actions in an
`operational_job_replay_failed` escalation bundle. It did not enqueue work.

## Cleanup Proof

After evidence capture, the complete disposable Railway environment was
deleted. A provider list returned only production and no environment with ID
`e5f5dc21-43d4-49b1-8a05-7dfa08447dff`. The temporary local PostgreSQL 14
server was stopped and both run-owned temporary directories were moved to the
system Trash.

## Pending Closure

Before `G3-03` closes:

1. merge and deploy this recovery implementation through the normal protected
   pull-request process
2. select the exact new platform deployment and its previous known-good target
3. use the canonical rollback command to roll back, verify provider and
   `/api/readiness` revision identity, then restore the reviewed forward
   deployment through the same exact-target mechanism
4. record both measured recovery times and final production readiness here

This is one remaining proof step, not an architecture gap.
