# Operational Alert Issue Projection Proof

Last updated: 2026-09-04  
Status: Gate `G4-03` implemented and locally proven

## Outcome

Air Jam now turns each confirmed internal alert into one maintained GitHub
issue without making GitHub the source of operational truth.

One `(repository, alertKey)` owns one durable projection and one issue. The
first actionable revision creates it, later revisions update it, recovery
closes it, and recurrence reopens it. Air Jam rewrites only a marked machine
block, so agent and maintainer notes outside that block survive unchanged.

The canonical behavior is defined in the
[Operational Alert Issue Projection Contract](../../contracts/operational-alert-issue-projection-contract.md).

## End-To-End Lifecycle Proof

The provider-fixture and PostgreSQL suites jointly prove the required story:

1. one confirmed alert creates one labeled issue
2. a second open revision updates that issue
3. recovery writes passed-verification evidence and closes it
4. recurrence writes failed-verification evidence and reopens it
5. the entire sequence retains one projection row and one issue number
6. source-event, SLO-evaluation, alert revision, and CLI inspection pointers
   remain in the managed block
7. human-authored text outside the block survives updates byte-for-byte
8. loss of the retained issue number reconciles by the hidden alert marker
   instead of creating a duplicate

The provider fixture injects a deterministic `fetch` implementation at the
adapter boundary. GitHub response documents are runtime-validated, every
request has a bounded timeout, pagination is bounded, rejected cached tokens
are evicted, primary and secondary throttling remain retryable, and an identity
conflict fails closed.

## Durable Queue And Failure Proof

Migration `0035_operational-alert-issue-projection.sql` adds one authority table
with a unique repository/alert key, exact target and projected revisions,
bounded attempts, availability, leased delivery authority, retained issue
identity, managed-body digest, and structured failure evidence.

The PostgreSQL suite proves:

1. concurrent `SKIP LOCKED` claims have one winner
2. owner, token, expiry, state, and revision fence completion
3. a static budget assertion keeps the 300-second lease above the adapter's
   conservative 22-request worst case at 10 seconds per request
4. expired leases return to the pending queue with visible attempt evidence
5. non-retryable permission failure becomes an inspectable dead letter while
   the authoritative alert remains open and unchanged, and later alert
   revisions cannot silently revive it
6. retries are bounded and use persisted availability rather than process
   memory
7. dead-letter requeue requires an actor, reason, attempt budget, and
   idempotency key
8. exact command replay returns the prior result, while reuse for different
   operator intent is rejected

The worker runs issue projection as an independent authority. Its failure is
visible in worker health, but it cannot block internal alert creation or starve
jobs, event delivery, cleanup, maintenance, or synthetics.

## Least-Privilege GitHub Boundary

Runtime delivery uses a repository-installed GitHub App with metadata read and
Issues read/write. The operational worker alone receives its App ID,
installation ID, private key, and exact `owner/name` repository. It requests a
short-lived issue-only installation token and caches that token only in process.

Partial configuration fails closed. Secrets are absent from persisted
documents, structured output, health responses, and CLI previews. A maintainer
personal access token is not a supported runtime identity.

## Agent Surface Proof

The complete lifecycle is discoverable through one repo-owned surface:

```bash
pnpm --silent run repo -- platform operations reliability alerts --help
pnpm --silent run repo -- platform operations reliability issues --help
```

Agents can inspect alert truth and projection status, list and inspect rows,
preview or execute one projection cycle, repair expired leases, and preview or
apply an audited dead-letter requeue. Reads return stable secret-free JSON;
mutations remain previews until `--apply` is explicit.

## Focused Validation

The implementation passed:

1. operations contract: `19/19`
2. GitHub adapter/provider fixture: `4/4`
3. PostgreSQL issue lifecycle and concurrency: `3/3`
4. repo CLI reliability contract: `5/5`
5. worker authority and drain behavior: `3/3`
6. platform and database-contract typechecks
7. focused lint and CI-structure contract checks
8. the repository batch gate on the final implementation revision

The GitHub `Tests` lane provisions PostgreSQL 17, applies the canonical
migrations, and runs the issue lifecycle and CLI database suites serially. The
proof is therefore retained as a regression contract rather than a one-time
local exercise.

## Deployment Boundary

This slice ships the schema, adapter, queue, worker integration, CLI, tests,
and deployment configuration. It deliberately does not provision or activate
the production operational worker. Gate `G3-08` owns that later preflight,
credential installation, migration verification, drain/rollback readiness,
cost observation, and live synthetic/issue evidence.

This distinction prevents a code-complete sensor from quietly becoming an
unobserved production actor.

## Remaining Debt

None inside the `G4-03` contract. Broader incident workflows, hosted reasoning,
additional notification providers, and automatic code-changing repair remain
optional post-1.0 capabilities that should be earned by observed need.
