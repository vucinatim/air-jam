# Production Recovery Contract

Last updated: 2026-09-04
Status: canonical contract

## Purpose

This contract defines Air Jam's small set of production recovery primitives.
It gives local agents reliable facts and bounded actions without prescribing a
generic incident workflow or attempting to replace Railway, PostgreSQL, or the
durable job system.

The recovery boundary has three layers:

1. Railway owns volume snapshots and deployment rollback
2. PostgreSQL custom-format backups provide portable, isolated restore proof
3. Air Jam's durable job authority owns exact work replay and lineage

These capabilities are composable inputs to a smart running agent. They are not
a self-healing state machine, remediation language, or second provider control
plane.

## Canonical Machine Surface

Discover the complete lifecycle through the repo CLI:

```bash
pnpm run repo -- platform recovery --help
pnpm run repo -- platform recovery status --help
pnpm run repo -- platform recovery backups schedule --help
pnpm run repo -- platform recovery restore --help
pnpm run repo -- platform recovery deployment rollback --help
pnpm run repo -- platform operations jobs replay --help
```

Use `pnpm --silent run repo -- ... --json` when stdout must contain only the
structured result. Credentials are resolved internally and never belong in
arguments, plans, evidence, documentation, or operator output.

## Recovery Authority By Data Class

| Data class                               | Recovery authority                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| PostgreSQL product and operations state  | Recurring Railway volume snapshots plus a portable logical backup and isolated restore |
| Immutable uploaded release archives      | Existing object identity and digest; never rewritten during recovery                   |
| Extracted release output and screenshots | Rebuilt by replaying the exact generation-scoped durable job                           |
| Managed creator media                    | Database identity plus the authoritative stored object                                 |
| Product telemetry                        | Database restore followed by the existing deterministic projection rebuild             |
| Deployment binaries                      | Exact Railway deployment, Git revision, and image identity                             |

Provider snapshots protect the production volume quickly, but Railway restores
them only inside the same project and environment. They therefore cannot prove
that Air Jam's data is portable or valid. The PostgreSQL logical restore is the
independent proof lane; neither mechanism replaces the other.

## Backup Policy

Production's authoritative PostgreSQL volume must have exactly these Railway
backup schedule kinds:

1. `DAILY`
2. `WEEKLY`
3. `MONTHLY`

Railway owns the actual cron placement and retention duration. Air Jam owns the
required schedule kinds and verifies them by provider read-back after every
change. Schedule mutation accepts only that complete set, so a partial request
cannot silently remove another required cadence. A successful mutation writes
a checksummed local evidence document. Missing or extra schedule kinds leave
recovery status unready.

The repo does not implement a custom snapshot scheduler.

## Portable Backup And Isolated Restore

`platform database backup` creates recovery contract version 2:

1. one exported PostgreSQL repeatable-read snapshot binds table counts and
   `pg_dump` to the same database point
2. the manifest records the source provider identity, database fingerprint,
   PostgreSQL server version, migration head, database size, every public and
   Drizzle table count, snapshot digest, artifact digest, and artifact size
3. the dump uses PostgreSQL's custom format and a compatible modern client
4. credentials reach libpq through environment variables, never process
   arguments or retained evidence

Restore is a three-step lifecycle:

1. `plan` validates the backup and current source migration catalog, inspects
   the exact target, and writes an immutable digest-addressed plan
2. `apply` requires the plan path, exact digest, actor, reason, idempotency key,
   and `--apply`; it restores with `--clean`, `--if-exists`,
   `--single-transaction`, and `--exit-on-error`
3. `verify` independently re-reads the target and requires the exact migration
   head and every captured table count

A restore target is eligible only when it is either an explicitly
operator-attested isolated loopback database or a provider-attested
non-production Railway database whose environment and service identities both
differ from the backup source. Because a loopback URL may hide a remote tunnel,
every loopback plan, apply, and verify invocation requires
`--attest-isolated-loopback`; agents must use it only after proving the target is
disposable and local. Production, unattested, and unclassified remote targets
are forbidden. The target PostgreSQL major version may not be older than the
source.

The immutable plan also binds the empty or pre-existing target fingerprint.
Changing the target, artifact, manifest, migration catalog, or plan invalidates
the operation. Reusing an idempotency key with the same plan returns the prior
result; reusing it with different intent is rejected.

Every failed or mismatched restore returns an escalation bundle that preserves
the exact target and plan while explicitly forbidding a broader or production
retry.

## Deployment Rollback

Deployment rollback uses Railway's own immutable deployment history. An apply
requires:

1. exact project, environment, and service IDs
2. the deployment currently observed by the operator as an optimistic fence
3. one different target deployment belonging to that same service and
   environment
4. Railway's positive `canRollback` attestation
5. an independent public readiness URL
6. actor, reason, and explicit `--apply`

Railway acknowledges rollback with a Boolean rather than returning the new
deployment identity. After positive acknowledgement, the operator polls the
exact service until a new current deployment matches the selected target's Git
revision, or its image digest when no revision exists. It tolerates transient
provider read errors inside that bounded attribution window, then waits for
terminal provider state and independently verifies:

1. the rollback deployment succeeded
2. it became the service's current deployment
3. its Git revision matches the selected target revision when one exists
4. application readiness is healthy and reports the exact new rollback
   deployment ID
5. when application readiness exposes a Git revision, it matches the
   provider-attested target revision

Railway-generated rollback deployments may omit the runtime Git revision even
though their provider deployment record retains it. The exact deployment ID is
therefore the mandatory application identity fence; a reported runtime revision
is an additional consistency check, not a prerequisite for rollback health.

Recovery time is measured from provider mutation through application
verification. After a positive provider acknowledgement, every attribution,
polling, provider-read, or verification failure returns an escalation bundle
and requires a fresh inspection before another exact action. Ambiguous mutation
responses are also preserved as structured evidence because a rollback may be
in flight. The operator never silently selects an unrelated deployment, an
older deployment, or a wider target.

Deployment rollback is a reversible provider action that a local agent may use
when incident evidence justifies it. Restoring production data remains a
separate human-approved action and is intentionally not exposed by this
isolated-restore command.

## Durable Job Replay

Jobs remain PostgreSQL-authoritative. Replay accepts only one exact `failed` or
`canceled` job ID plus actor, reason, idempotency key, and explicit `--apply`.
It uses the existing domain service; there is no recovery-only queue.

After enqueue, the operator independently re-reads the persisted job and
requires:

1. a new job ID pointing to the exact original through `replayOfJobId`
2. identical job kind, creator, game, release, generation, resource, and
   correlation scope
3. one persisted `replayed` audit event carrying the requested actor, reason,
   correlation ID, and lineage detail

The replay may then progress through the ordinary worker lifecycle. Verification
proves exact enqueue and lineage, not that an external dependency will make the
new attempt succeed. Ineligible jobs, conflicts, or verification mismatches
return a structured escalation bundle and do not fall back to a broader replay.

## Evidence And Cleanup

Local operational evidence lives under ignored `.airjam/operations` paths with
owner-only permissions. It may contain resource identifiers and row counts but
not credentials or raw private job payloads. If evidence persistence fails
after a provider mutation, the CLI still returns the complete provider result,
reports the evidence failure separately, and exits nonzero; it never hides an
already-completed rollback or schedule change behind a local filesystem error.

An isolated drill is incomplete until it records:

1. recovery point and recovery time
2. source and target identities
3. migration and data-invariant checks
4. replay lineage and audit checks when exercised
5. provider verification that run-owned external resources were deleted

Long-lived summaries belong in the Gate 3 recovery proof, not in a second
execution tracker.

## Deliberate Non-Goals

This contract does not add:

1. a custom backup engine or snapshot scheduler
2. automatic production database restore
3. an incident DSL or mandatory runbook state machine
4. arbitrary code-changing remediation
5. a swarm scheduler or hosted reasoning service
6. a second deployment or job authority

Future agents should combine these focused capabilities with operational
events, alerts, GitHub issues, logs, health, and Railway inspection according to
the incident in front of them.
