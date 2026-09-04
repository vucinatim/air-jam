# Operational Alert Issue Projection Contract

Status: canonical 1.0 contract  
Owner: operational worker  
Release item: `G4-03`

## Purpose

Air Jam projects confirmed internal alerts into GitHub so local agents and
maintainers have one durable place to notice, coordinate, diagnose, and retain
the outcome of an operational problem.

This is deliberately a narrow projection, not a second incident system.
`operational_alerts` remains Air Jam source truth. GitHub owns collaboration,
assignment, comments, and issue history. Railway owns deployment and provider
state. An agent must re-read those sources before acting instead of treating an
issue body as current runtime authority.

## Identity And Lifecycle

One `(repository, alertKey)` owns one projection row and one GitHub issue.
Volatile timestamps, summaries, request IDs, deployment IDs, and alert
revisions never enter that identity.

The current alert revision drives the projection:

1. the first confirmed alert creates one labeled issue
2. a later open revision updates the same issue
3. a recovered revision updates and closes it
4. recurrence under the same alert key updates and reopens it
5. an already-equivalent issue is retained as `unchanged`

The projection snapshots the exact target alert document before claiming a
lease. A newer alert revision waits for the current delivery to finish and then
becomes the next target. Completion records the exact projected revision,
GitHub issue identity and state, managed-block digest, and database-authority
timestamp.

## Managed Issue Surface

Every issue carries the machine-discoverable
`airjam:operational-alert` label and one hidden alert-key marker. Air Jam owns
only the text between its managed start/end markers.

The managed block contains:

1. current alert status, severity, environment, service, and policy
2. first and last observation time, occurrence count, and revision
3. stable pointers to the alert, source event, and SLO evaluation
4. the canonical repo CLI inspection command
5. explicit current verification evidence: failed while actionable or passed
   at recovery

Text outside the block is preserved byte-for-byte. That is where human and
agent diagnosis, ownership, plans, and discussion live. A malformed block or a
marker for another alert key fails closed rather than overwriting discussion.
GitHub's own close/reopen history retains recovery and failed-verification
transitions without duplicating an application-owned incident timeline.

## Durable Delivery

`operational_alert_issue_projections` is the sole delivery record. It contains
the target and projected alert revisions, bounded attempt budget, availability,
lease authority, issue identity, body digest, structured failure, and the
versioned redacted machine document.

Delivery states are:

1. `pending`
2. `delivering`
3. `delivered`
4. `dead_letter`

PostgreSQL row locks with `SKIP LOCKED`, lease tokens, exact revisions, and a
unique alert/repository index prevent duplicate worker authority. Retry uses
bounded exponential backoff. Non-retryable authorization failures and exhausted
attempt budgets become visible dead letters; they never roll back or mutate the
source alert.

An uncertain provider outcome is reconciled before creation. The adapter first
uses a retained issue number, then scans a bounded set of labeled issues for the
exact hidden alert-key marker. A crash after GitHub accepted a create/update can
therefore converge without creating a second issue.

Expired leases are repairable. Dead letters can be requeued with an actor,
reason, explicit attempt budget, and idempotency key. The requeue and its source
alert link are recorded as an operational event.

## GitHub Authority

The adapter authenticates as a repository-installed GitHub App. The App needs:

1. repository metadata: read
2. issues: read and write
3. access only to the configured Air Jam repository

The operational worker alone receives:

1. `AIRJAM_GITHUB_ISSUES_APP_ID`
2. `AIRJAM_GITHUB_ISSUES_INSTALLATION_ID`
3. `AIRJAM_GITHUB_ISSUES_PRIVATE_KEY`
4. `AIRJAM_GITHUB_ISSUES_REPOSITORY` in `owner/name` form

All four values are required together. The private key never enters platform
web, realtime server, browser worker, creator code, database records, health
responses, or CLI output. Installation tokens are short-lived and cached only
inside the worker process. A maintainer personal token is not a supported
runtime identity.

## Worker And Machine Surface

The operational worker checks the projection queue every five seconds by
default. `AIRJAM_PLATFORM_WORKER_ISSUE_PROJECTION_MS` may change that cadence.
Issue delivery is an independent worker authority: a failure is visible in
worker status but cannot make internal alert creation fail or starve jobs,
events, cleanup, or synthetics.

Agents discover and operate the lifecycle through:

```bash
pnpm --silent run repo -- platform operations reliability alerts --help
pnpm --silent run repo -- platform operations reliability issues --help
```

The surface supports alert inspection, projection status/list/inspection, a
preview-first one-item delivery, expired-lease repair, and an audited
preview-first dead-letter requeue. Railway targeting continues to use the
existing `--railway-environment` and `--railway-project` boundary without
printing database credentials.

## Verification

The 1.0 proof must demonstrate:

1. one alert key creates, updates, resolves, and reopens one issue
2. human-authored text survives every managed-block update
3. a missing retained issue identity reconciles by marker instead of creating a
   duplicate
4. two workers cannot hold the same projection lease
5. expired leases repair and bounded failures become inspectable dead letters
6. permission failure leaves the internal alert unchanged
7. requeue is audited and idempotent
8. contract, provider-fixture, PostgreSQL, worker, CLI, migration, and deploy
   checks run in CI

## Explicit Non-Goals For 1.0

This contract does not add:

1. a generic incident record or workflow engine
2. PagerDuty, Slack, email, or paid notification infrastructure
3. a hosted reasoning loop or automatic code-changing agent
4. issue text as runtime or deployment authority
5. automatic remediation triggered only by product analytics

Smart local agents remain free to investigate and choose actions. This bridge
only gives them a trustworthy, durable signal and coordination rendezvous.
