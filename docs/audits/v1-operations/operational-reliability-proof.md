# Operational Reliability Proof

Last updated: 2026-09-04
Status: Gates `G4-02` and `G4-07` implemented and locally proven

## Outcome

Air Jam now has one durable, agent-operable reliability loop for structured
failures, operational-event delivery, launch-critical synthetics, SLO
evaluation, and internal alert state.

The canonical behavior is defined in the
[Operational Reliability Contract](../../contracts/operational-reliability-contract.md).

The `G4-07` hardening pass preserves that architecture and closes five review
gaps before continuous production execution: adversarial secret-key filtering,
single-source failure identity, database-owned synthetic chronology, per-check
scheduler isolation, and stale SLO fencing.

## Proven Launch Stories

The source-owned policy and executor prove all six roadmap stories:

1. landing and docs
2. Arcade discovery and immutable hosted-release rendering
3. platform and realtime health
4. room creation and controller connection
5. replicated state and one semantic gameplay action
6. release-delivery dependencies, including platform boundaries plus
   operational-worker and browser-worker readiness

One PostgreSQL-backed pipeline proof executes every check, persists all six run
documents, creates all six synthetic operational events, and evaluates their
bound SLOs. The semantic checks use protocol-faithful host/controller sockets;
they do not bypass the public protocol by calling domain methods.

The retained breach/recovery proof persists three failures followed by three
healthy runs. It proves one durable alert opens after the declared breach
streak, replays idempotently, then recovers after the declared recovery streak
with coherent revisions and event evidence.

This is local implementation evidence. Production deployment and failure drills
remain governed by later Gate 4 and Gate 7 items; this document does not claim
that production notifications or remediation are already live.

## Durable Delivery Proof

The PostgreSQL suite proves:

1. exact event-ID replay and conflict rejection
2. one winner under concurrent `SKIP LOCKED` claims
3. lease-token, owner, state, attempt, and expiry fencing
4. bounded retry followed by non-retryable dead-lettering
5. exact event-store persistence before outbox completion
6. expired-lease repair
7. preview-first dead-letter requeue
8. idempotent command replay and conflicting-key rejection
9. retained previous attempt evidence and a separately delivered audit event

The migration was regenerated from the shared database contract, applied to a
fresh local Postgres authority, and then checked again with Drizzle. Drizzle
reported `37 tables` and `No schema changes, nothing to migrate`.

## Structured Failure And Trust Proof

All four roadmap producer classes now have a structured path:

1. Next.js Node request-boundary failures become bounded platform events
2. realtime auth-authority and runtime-usage persistence failures become
   bounded server events
3. operational-job terminal and retry failures become transactionally owned
   worker events
4. SDK host/controller render crashes become strict hosted-runtime reports

Tests prove raw database URLs, authorization values, credentials, messages,
stacks, full URLs, and secret-shaped nested details do not enter the durable
documents or safe logs.

The adversarial vocabulary covers camel case, snake case, kebab case, uppercase,
and compact compound key names such as API, signing, private, and encryption
keys. Negative controls prove unrelated evidence names containing `key`-like
text are not discarded. A malformed realtime failure code is normalized once
and the persisted event kind exactly equals the retained failure code.

Hosted-runtime reports are accepted only from the socket authorized for the
declared room and role, are client- and room-rate-limited, derive runtime
identity from server state, and persist as `runtime_reported`. A duplicate
report is idempotent; reuse of its ID for different evidence fails closed.

## Agent Surface Proof

The repo CLI discovers and operates the complete lifecycle:

```bash
pnpm run repo -- platform operations reliability --help
pnpm run repo -- platform operations reliability events --help
pnpm run repo -- platform operations reliability synthetics --help
pnpm run repo -- platform operations reliability alerts --help
pnpm --silent run repo -- platform operations reliability catalog --json
```

The CLI contract suite proves:

1. six checks and four SLOs are inspectable without a database
2. event status, list, inspect, one-cycle delivery, expired-lease repair, and
   dead-letter requeue are discoverable
3. synthetic run, due-run, retained-run, SLO, and alert reads are discoverable
4. mutations are read-only previews unless `--apply` is explicit
5. audited mutations require actor, reason, and idempotency key
6. payload values, failure details, and lease tokens are absent from JSON reads

The due-run apply result additionally exposes one outcome per catalog check and
aggregate due/completed/failed/skipped counts. A failure in the first check is
proven not to starve the other five, and the worker retains the failed synthetic
authority instead of reporting the resolved batch as healthy.

## Chronology And Concurrency Hardening Proof

Synthetic network duration is measured independently of wall-clock time. The
persistence transaction acquires the SLO stream lock, reads PostgreSQL authority
time, rebases the retained run and evidence to it, and uses the same timestamp
for its event and SLO window.

The PostgreSQL regression suite persists a complete breach and recovery stream,
then deliberately submits an older failure. It proves:

1. the late run and event remain available as historical evidence
2. no stale SLO evaluation is inserted
3. the result reports `evaluationDisposition: "stale_ignored"`
4. recovered alert state, recovery timestamp, occurrence count, and revision do
   not regress

The advisory lock also serializes production timestamp assignment with SLO
evaluation. The explicit stale fence remains necessary for imported historical
evidence and deterministic tests.

## Worker And Health Proof

The worker readiness suite proves job, maintenance, lifecycle-cleanup,
event-delivery, and synthetic authorities retain independent state. Job and
event-delivery database authority gate `/ready`; a successful unrelated loop
cannot erase a failure. Auxiliary failures remain visible as degraded
authorities.

The platform health contract fails production readiness when the cookieless
release origin, release storage, or moderation/browser dependency is required
but unavailable. The release-dependency synthetic additionally checks the
operational worker and browser worker public health boundaries.

## Focused Validation

The following focused evidence passed against the local migrated PostgreSQL
authority:

1. operations contract: `18/18`
2. operational reliability PostgreSQL invariants: `4/4`
3. repo CLI reliability contract: `4/4`
4. realtime server targeted suites green, including PostgreSQL publisher `3/3`
5. hosted SDK error-boundary behavior: `3/3`
6. platform policy, executor, health, request reporting, and worker suites,
   including chronology and scheduler isolation: focused suites green
7. platform, SDK, and realtime-server targeted typechecks
8. Drizzle schema drift check with no ungenerated migration

The repository-wide `pnpm check:ci` result is retained as a separate typed
readiness evidence reference so narrow tests are not used to claim broad
integration safety.

## Remaining Gate Boundary

`G4-02` and its `G4-07` foundation hardening intentionally end at durable
internal alerts. They do not implement:

1. incident fingerprint persistence and recurrence correlation
2. external notification routing
3. GitHub issue creation or maintenance
4. governed runbook execution
5. bounded automatic remediation
6. a generic incident lifecycle

The original proof assigned these broadly to `G4-03` through `G4-06`. The
maintainer's `2026-09-04` scope refinement keeps only narrow alert-key
GitHub issue projection in 1.0 as `G4-03`; the generic incident and runbook
machinery moved to post-1.0. Any later implementation must still consume the
durable evidence proved here rather than creating a parallel source of truth.
