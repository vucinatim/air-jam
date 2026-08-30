# Production Durable Job Authority Proof

Last updated: 2026-08-30
Status: Gate `G3-02` durable-authority foundation implemented and locally proven

## Outcome

Air Jam now has a versioned PostgreSQL authority for bounded release work. It
does not use an in-memory queue, a request-lifetime counter, or the isolated
Playwright service as release-state authority.

This document records the durable-authority foundation as it landed. The later
[production release job worker proof](./production-release-job-worker-proof.md)
records the completed executor and adapter cutover built on this authority.

## Canonical Work Kinds

| Kind                          | Lane                 | Global | Per creator | Queue | Attempts |
| ----------------------------- | -------------------- | -----: | ----------: | ----: | -------: |
| `release_artifact_processing` | `release_processing` |    `4` |         `2` |  `50` |      `3` |
| `release_browser_validation`  | `browser_validation` |    `2` |         `1` | `100` |      `3` |
| `release_image_moderation`    | `moderation`         |    `2` |         `1` | `100` |      `3` |

The source catalog also owns lease, deadline, and retry-backoff bounds. The
database independently checks kind-to-lane mapping, job lifecycle shape,
attempt bounds, revisions, and scope integrity.

Across all three kinds, one creator may hold at most two active leases. The
kind-specific lower browser/moderation bound still prevents one creator from
occupying both scarce provider-backed slots.

Artifact, browser, and moderation work remain separate kinds because they have
different cost, concurrency, degradation, and retry ownership. A single opaque
"finalize" job would prevent the budget ladder from controlling those lanes
independently.

## Durable State And Fencing

Every caller mutation first persists in one global command ledger. Enqueue,
cancel, replay, and expired-work repair share that authority. The ledger stores
the canonical hash of every caller-controlled semantic input plus an immutable
result, including an empty repair batch, so retrying a completed command cannot
act on later state.

Every job persists:

1. creator, game, release, kind, lane, contract version, and correlation ID
2. its creating command identity and canonical request hash
3. queued, running, cancel-requested, succeeded, failed, or canceled state
4. availability, deadline, attempt count, and maximum attempts
5. worker identity, random lease token, lease expiry, and heartbeat time
6. structured JSON progress, result, and last error objects
7. optimistic revision, replay lineage, and lifecycle timestamps

Every semantic transition writes one append-only event in the same database
transaction. Event revisions are unique and contiguous per job. Heartbeats
renew only the lease and do not create event noise.

Claims use PostgreSQL transaction locks and `FOR UPDATE SKIP LOCKED`. Claim and
lane-mode mutation share one lane lock: `normal` and `restricted` may drain
admitted work, while `paused` starts no queued work. The claim path checks
source-owned global and per-creator capacity before it assigns a random lease
token.

Production calls derive lease truth from PostgreSQL time. A lease is capped at
the absolute job deadline, and stage, success, failure, and heartbeat writes
all reject at or after that deadline even if a caller still holds the old
token. Repair owns the resulting terminal transition. An expired, replaced, or
late worker cannot commit through the database authority.

Retryable failure releases the lease and schedules exponential bounded
backoff. Attempts increment when work is actually claimed, not when it is
merely queued. Expired leases are recovered for another bounded attempt, while
expired deadlines and exhausted attempts become inspectable terminal failures.

Queued cancellation is immediate. Running cancellation is cooperative and
retains the lease until the worker acknowledges it or the reaper observes an
expired lease. Replay creates a new job linked to immutable terminal history;
it never resets an old row.

## Scope And Evidence Integrity

Composite database foreign keys prove that:

1. the game belongs to the recorded creator
2. the release belongs to the recorded game
3. a replay points to a real prior job
4. replay lineage cannot cross release scope and an event cannot cause itself
5. release checks may identify only a job from the same release and a positive
   attempt; deleting the owning job cascades its dependent check rather than
   leaving contradictory partial provenance

Only one active job of one kind may exist for one release. Caller idempotency is
global across command kinds. Concurrent reuse returns the command's immutable
original result when every semantic input is identical and raises a typed
conflict otherwise; priority, explicit correlation, actor, and reason are part
of that identity.

## Agent Surface

The complete current authority is discoverable through:

```bash
pnpm --silent run repo -- platform operations jobs --help
pnpm --silent run repo -- platform operations jobs policy --json
pnpm --silent run repo -- platform operations jobs status --json
pnpm --silent run repo -- platform operations jobs list --help
pnpm --silent run repo -- platform operations jobs inspect --help
pnpm --silent run repo -- platform operations jobs cancel --help
pnpm --silent run repo -- platform operations jobs replay --help
pnpm --silent run repo -- platform operations jobs repair-expired --help
```

Reads return stable operator JSON. Lease tokens, request hashes, raw payloads,
progress, results, errors, command bodies, and event details stay on worker or
internal authority paths. Mutations are previews unless `--apply` is present
and require actor, reason, and caller idempotency. Cancellation also requires
the inspected expected revision. The CLI delegates to the same job services a
future dashboard and machine API use; workers use a separate lease-bearing
contract.

## Validation

A fresh native PostgreSQL cluster received every migration from `0000` through
`0026`. Twenty-three focused policy and PostgreSQL tests proved:

1. canonical concurrent idempotency and conflicting-payload rejection
2. global cross-kind serialization and scheduling/audit input hashing
3. one active kind-and-release job under concurrent enqueue
4. priority ordering, creator fairness, and global concurrency bounds
5. the creator concurrency ceiling across different job kinds
6. heartbeat renewal and wrong/expired-token fencing
7. deadline-capped leases and rejection of every late worker mutation
8. post-lock database-time sampling across deadline and lease expiry
9. lease-token and worker-identity ownership fences
10. normal/restricted draining and paused-lane claim denial
11. expired-lease recovery, replacement ownership, and stale-worker rejection
12. immutable replay of an empty repair before later work expires
13. retry availability timing and terminal non-retryable failure
14. immediate queued and cooperative running cancellation with exact previews
15. terminal replay lineage and replay idempotency
16. canonical JSON validation before request hashing and persistence
17. worker-secret, raw-JSON, and malformed error-code redaction
18. release-scoped replay and check provenance plus deletion behavior
19. rejection of self-causing events
20. contiguous append-only event revisions through retry and success

Five CLI contract cases also proved discovery, bounded reads, preview-first
mutations, database-free policy output, and real database-backed redaction.
Platform typechecking, focused lint, formatting, and migration generation
checks passed. The isolated database contains no production data and production
control state was not changed.

## Subsequent Layer

This foundation did not by itself make release processing durable. The
generation and worker slices subsequently completed the following layer:

1. carry immutable generation identity and first-observed object facts into
   every executor payload
2. add job-attempt identity where retryable output is produced
3. require the current lease owner as well as the current generation before an
   executor may transactionally commit an outcome
4. make artifact, browser, and moderation executors idempotent per attempt
5. make finalize, ops moderation, UI, machine API, SDK, CLI, and MCP converge on
   enqueue-and-inspect semantics
6. a separate platform job-worker process must claim work, expose health, stop
   claiming on termination, and be deployed as a fourth Railway service

That migration is now complete: concurrent-release-job quota authority reads
the durable active-job domain, and legacy request work no longer exists. See the
worker proof for current behavior, validation, and remaining Gate `G3-02` work.

The lifecycle contract version does not claim job-kind payload typing. Each
executor must introduce its own versioned runtime schema before it is wired;
the current JSON columns are durable internal envelopes, not a frozen public
payload API.
