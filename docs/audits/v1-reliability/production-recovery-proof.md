# Production Recovery Proof

Last updated: 2026-09-04
Status: complete

This evidence record supports readiness item `G3-03`. The
[production recovery contract](../../contracts/production-recovery-contract.md)
owns the durable architecture; this document records what was exercised.

## Current Verdict

The production backup policy, portable database restore, exact durable-job
replay, exact deployment rollback, and forward recovery are implemented and
live-proven through the canonical repo CLI. The final production cycle verified
both directions and left the platform on the newest reviewed revision.

The backup, isolated-restore, and replay legs ran at
`811d6c7ff031c643b66f288c03bf5d5a14115b5a`; the stricter target-name
attestation then landed at `7c1478588069c58b73e0099a09bcf404539103c7`
before PR `#92` merged. The recorded disposable target predates that final
guard, but the shipped resolver now obtains and attests its environment name or
fails closed. The final rollback and forward-recovery legs ran against the
reviewed code that ships.

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

## Deployment Rollback And Forward Recovery Drill

The recovery implementation landed through reviewed PRs
[`#92`](https://github.com/vucinatim/air-jam/pull/92),
[`#93`](https://github.com/vucinatim/air-jam/pull/93), and
[`#94`](https://github.com/vucinatim/air-jam/pull/94). Each merged through the
normal protected-branch flow after required CI and Railway previews passed.
PR `#92` received a GitHub-native Opus review with verdict `CLEAR TO MERGE`;
PR `#93` received the same verdict, corrected the live Railway mutation
contract, and resolved every recorded finding; PR `#94` received the third
PR-specific `CLEAR TO MERGE` review for the runtime identity correction.
Canonicalizer sessions ended `ready` before both substantial push batches.

Two safe discovery failures improved the contract before the final proof:

1. the first apply used a selection set against Railway's scalar Boolean
   `deploymentRollback` response. GraphQL rejected the request before mutation;
   production remained on deployment `9851cbb6-f5ca-4345-8920-e83ba74a8334`
   and trace `7226484483712567756` preserved the provider error
2. after the Boolean correction, the first backward and forward operations
   succeeded at Railway but returned `verification_failed` because rollback
   instances omit the runtime Git SHA. Both operations still persisted exact
   post-mutation evidence instead of hiding the production transition. Live
   readiness proved Railway does expose the new rollback deployment ID, so the
   application fence was corrected to require that exact identity and to
   cross-check a runtime revision only when present

The final verified cycle was:

| Direction | Current deployment                     | Selected target                        | New deployment                         | Revision                                   | Recovery time | Evidence SHA-256                                                   |
| --------- | -------------------------------------- | -------------------------------------- | -------------------------------------- | ------------------------------------------ | ------------: | ------------------------------------------------------------------ |
| Backward  | `db4c6970-729e-44f1-9ece-c151ef552a71` | `7027e5df-f7e7-4fa0-9b47-69037110640b` | `513fb753-069f-4458-aa8a-08ddb65500bb` | `0ac9ebdc922a194b9465cb87b62e49cbab26d9ff` |     10,526 ms | `2f6cfc9e5d8d5324b6c7fbd346876616354919a25231362b60452ae1ae4546b5` |
| Forward   | `513fb753-069f-4458-aa8a-08ddb65500bb` | `db4c6970-729e-44f1-9ece-c151ef552a71` | `939dd708-d1d3-4788-a460-5d3cc1ce5f35` | `8bf765f45e217281daa30bb1a471066d097969e7` |      8,248 ms | `83c04b18c5a592eba7b93dc839587fb1fca9371eb35bc07dc8fbcba7ee4f46fe` |

Both results were `verified`. In each direction Railway reported terminal
`SUCCESS`, the attributed deployment became current, its provider revision and
matched the selected target, and `https://airjam.io/api/readiness` returned HTTP
`200`, `ok: true`, and the exact new deployment ID. The retained records also
show that each image digest equaled its selected target, although revision was
the attribution fence used in these two operations. The operation digests were
respectively
`ba842af9b7e0a2e7bda75d8d8007383061354f6c793990102b2d715f83100da7`
and `29f602bf0effb1f8ea35bd041c56dd4282776ce6cabba3ed5c844e43c368de61`.

Final provider inspection reported deployment
`939dd708-d1d3-4788-a460-5d3cc1ce5f35` as current and successful on revision
`8bf765f45e217281daa30bb1a471066d097969e7`. Public readiness reported the same
deployment ID with hosted release origin, request policy, and schema head
`0036` all ready. The runtime revision is `null` by Railway rollback behavior;
the provider record remains the revision authority for that instance.

## Cleanup Proof

After evidence capture, the complete disposable Railway environment was
deleted. A provider list returned only production and no environment with ID
`e5f5dc21-43d4-49b1-8a05-7dfa08447dff`. The temporary local PostgreSQL 14
server was stopped and both run-owned temporary directories were moved to the
system Trash.

## Closure

Readiness item `G3-03` is complete. Its typed evidence references the portable
repository proof, reviewed merge commits, and the three pull requests. The proof
records the hashes and exact identities of the owner-only backup, restore, and
rollback evidence without making release readiness depend on one operator's
local `.airjam` directory. No production database row or stored object was
mutated by the proof, and no disposable Railway or local PostgreSQL resource
remains.
