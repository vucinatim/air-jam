# Air Jam 1.0 Release Execution Plan

Last updated: 2026-09-04
Status: active subordinate execution plan

Related docs and machine surfaces:

1. [1.0 Release Roadmap](./v1-release-roadmap-plan.md)
2. [Current State](../current-state.md)
3. [Working Agreements](../working-agreements.md)
4. [Deployment And Monetization Strategy](../strategy/deployment-and-monetization-strategy.md)
5. [Machine Execution Manifest](../../scripts/repo/programs/v1-release-program.json)
6. [Gate 1 Codebase Assessment](../audits/v1-canonicalization/codebase-assessment.md)
7. [Gate 1 Canonicalization Execution Set](../audits/v1-canonicalization/canonicalization-execution-set.md)

## Purpose

This plan defines how Air Jam executes the 1.0 roadmap with the highest safe
degree of agent autonomy.

It does not redefine the product or release gates. The
[1.0 release roadmap](./v1-release-roadmap-plan.md) remains the authority for
what 1.0 means and what evidence closes each gate.

This plan owns:

1. dependency-aware work packages
2. execution lanes and sequencing
3. agent ownership and claiming
4. batched human checkpoints
5. blocker handling
6. evidence-backed progress state
7. the estimated work and calendar envelope

The machine-readable execution state lives in
[`scripts/repo/programs/v1-release-program.json`](../../scripts/repo/programs/v1-release-program.json).
Agents must inspect and mutate that state through the repo CLI rather than
manually maintaining a second checklist.

## Program Estimate

Planning envelope:

1. `285-520` active agent execution hours
2. `28-56` maintainer hours, concentrated into explicit checkpoints
3. `5-7` likely calendar weeks with stable boundaries and parallel execution
4. `3-4` aggressive weeks if audits and production proofs reveal little fallout
5. `8-10` conservative weeks if canonicalization, security, or scale work finds
   a real redesign

These are scheduling estimates, not completion evidence. The program closes
only through the roadmap gates.

## One Authority Per Kind Of Truth

The execution system has four non-overlapping authorities:

1. **Product and release authority**:
   [v1-release-roadmap-plan.md](./v1-release-roadmap-plan.md)
2. **Machine execution authority**:
   `scripts/repo/programs/v1-release-program.json`
3. **Quick human snapshot**: [current-state.md](../current-state.md)
4. **Historical memory**: [work-ledger.md](../work-ledger.md)

Rules:

1. the roadmap defines gates, promises, cuts, and done criteria
2. the manifest defines work-item dependencies, estimates, owners, state,
   blockers, and evidence references
3. `current-state.md` changes only at meaningful phase closures or
   reprioritizations
4. `work-ledger.md` records durable milestones after they happen
5. GitHub issues may represent defects or operational incidents but do not
   replace the release program
6. chat history is never the only location of a decision or completion claim

## Canonical CLI

Discover the execution surface:

```bash
pnpm run repo -- readiness --help
```

Use stable JSON for agent reads:

```bash
pnpm --silent run repo -- readiness status --json
pnpm --silent run repo -- readiness next --json
pnpm --silent run repo -- readiness inspect G1-01 --json
pnpm --silent run repo -- readiness validate --json
```

When an audit discovers additional in-scope release work, add it through a
preview/apply mutation rather than hiding it in prose:

```bash
pnpm run repo -- readiness add G1-07 \
  --gate G1 \
  --lane canonicalization \
  --priority 60 \
  --title "Close the discovered canonicalization gap" \
  --depends-on G1-01 \
  --agent-hours-min 2 \
  --agent-hours-max 4 \
  --evidence-requirement "focused regression proof"
```

The addition updates the total execution estimate automatically. Pass `--apply`
only after previewing the result.

`readiness add` creates autonomous work only. Adding another human checkpoint
or production approval changes the program contract and therefore requires an
explicit reviewed manifest and plan change.

Claim work through an explicit applied transition:

```bash
pnpm run repo -- readiness update G1-01 \
  --status in_progress \
  --owner /root/canonicalization \
  --apply
```

Preview completion before applying it:

```bash
pnpm run repo -- readiness update G1-01 \
  --status complete \
  --owner /root/canonicalization \
  --evidence document:docs/audits/v1-canonicalization/v1-canonicalization-audit.md \
  --evidence command:pnpm-test-repo-contracts
```

The same command with `--apply` persists the transition. Omission of `--apply`
is always read-only.

## Work-Item State Contract

Supported states:

1. `pending`: unclaimed and either ready or waiting on dependencies
2. `in_progress`: claimed by one canonical agent task or human owner
3. `blocked`: unable to progress for a specific external, human, or technical
   reason
4. `complete`: acceptance criteria are satisfied and evidence is retained

`ready` is derived rather than stored. A pending item is ready when every
declared dependency is complete.

Completion rules:

1. every completed item has at least one typed evidence reference
2. human checkpoints require `decision:` evidence
3. production-approval items require both `decision:` evidence and terminal
   `command:` or `url:` evidence
4. completed work cannot be reopened accidentally; reopening requires
   `--reopen`
5. `in_progress` and `blocked` items require an owner
6. blocked work requires a typed blocker and concise explanation
7. dependencies cannot be bypassed by a normal status transition
8. applied updates use a short manifest lock and reject ownership takeover, so
   concurrent agents cannot silently claim the same item

Evidence reference types:

1. `artifact:file:<repo-path>` for durable generated proof retained in the
   repository
2. `artifact:git:<commit>` or `artifact:git-range:<start>..<end>` for immutable
   repository history; git evidence uses full lowercase 40-character commit
   SHAs and validation requires a checkout containing the referenced history
3. `command:` a deterministic validation or terminal operation
4. `decision:` an explicit maintainer or ratified program decision
5. `document:` a repo document containing the durable result
6. `url:` a stable external result such as a deployment, workflow, issue, or
   published release

The manifest stores references rather than embedding large logs or screenshots.

## Autonomous Operator Loop

The default long-running agent loop is:

1. run `readiness status --json`
2. run `readiness next --json`
3. select the highest-priority ready autonomous item that does not conflict
   with active ownership
4. inspect the work item, roadmap gate, relevant architecture, and source
5. claim the item as `in_progress`
6. implement the smallest complete end-state slice
7. run focused validation and then the gate-appropriate broader checks
8. self-review the diff and authority boundaries
9. retain evidence references
10. preview the completion transition
11. apply completion only when the evidence satisfies the item
12. select the next ready item without waiting for a progress conversation

Agents stop and request direction only when:

1. a ready `human_checkpoint` is the decision required to unlock the next
   meaningful work
2. a `production_approval` item is ready and the action has material external
   effect
3. a discovered decision would change the ratified product contract or expand
   scope materially
4. every autonomous ready item is complete, claimed, or genuinely blocked

Agents do not stop merely because:

1. one unrelated work item is waiting on an external provider
2. one human checkpoint is not yet ready
3. a test or audit discovered additional in-scope work
4. a long-running soak or deployment is in progress while another lane is ready

## Blocker And Continuation Policy

When work cannot proceed:

1. classify the blocker as `technical`, `external`, or `human`
2. retain the exact failed command, provider state, or missing decision
3. mark only the affected work item blocked
4. do not inflate a local blocker into a program-wide blocker
5. return to `readiness next` and continue an independent ready item
6. batch related human questions into the nearest explicit checkpoint
7. retry external state only when there is a reason to expect change

The program is globally blocked only when no autonomous work is ready and every
remaining dependency path terminates at an unresolved checkpoint or external
condition.

## Human Checkpoint Policy

Maintainer judgment is intentionally concentrated into six checkpoints:

1. `G0-03`: product, naming, compatibility, budget, quota, and autonomy
   decisions
2. `G1-04`: public compatibility changes and high-impact removals
3. `G4-05`: production automatic-remediation allowlist
4. `G5-04`: residual security risk acceptance
5. `G6-05`: final social experience, demonstration, and public story
6. `G7-04`: final go/no-go

Final release authority is intentionally separate from product review.

Checkpoint preparation rules:

1. present one coherent decision packet, not a stream of small questions
2. include the recommendation, alternatives, evidence, cost, and consequence of
   delay
3. pre-resolve implementation details that do not need product authority
4. make the default recommendation safe enough to approve directly
5. record the decision in the repo immediately after it is made

## Production Authority Policy

Most of the program is autonomous in local, isolated, preview, or staging
environments.

The following remain explicit production-approval items:

1. publishing the prerelease and deploying the exact candidate (`G7-02`)
2. publishing 1.0 packages, production release, article, and launch distribution
   (`G7-05`)

Production diagnostics, bounded reads, preview environments, dry runs, and
isolated drills remain autonomous when they do not create a material external
effect.

No work item authorizes:

1. destructive production database operations
2. secret disclosure or unreviewed secret rotation
3. purchasing or raising infrastructure budgets
4. public communication outside the approved launch package
5. irreversible provider or account changes unrelated to its acceptance
   criteria

## Execution Waves

### Wave 0: Freeze The Shared Contract

Primary work:

1. draft the product/client decision packet
2. draft the cost/capacity/autonomy decision packet
3. ratify both in one checkpoint
4. publish the final Gate 0 contract

Parallel work allowed while the checkpoint is prepared:

1. architecture audit
2. reliability and provider-control inventory
3. threat model

Expected elapsed time: `1-2` days.

### Wave 1: Canonicalize Centrally

Primary work:

1. architecture and authority audit
2. public-surface and package audit
3. one removal/refactor set
4. one approval checkpoint for compatibility-impacting removals
5. implementation and clean quality-gate closure

Shared contracts are stabilized here before broad parallel implementation.
Feature expansion remains frozen until this wave closes. The accepted work is
implemented through the deletion-first bundles in the
[canonicalization execution set](../audits/v1-canonicalization/canonicalization-execution-set.md),
not as independent finding-by-finding patches.

Before implementation, record an exact committed baseline. At bundle and Gate
1 closure, report Git additions and deletions separately for production source,
tests, documentation/guidance, and generated artifacts. Line counts are
supporting evidence; removal of duplicate owners and retention of one proven
canonical path are the acceptance criteria.

Expected elapsed time: `4-7` days.

### Wave 2: Parallel Foundation Lanes

Once Gate 1 boundaries are stable, execute these lanes in parallel:

1. `golden-path`: external-agent lifecycle and public blockers
2. `reliability`: cost limits, queues, cleanup, recovery, and load
3. `operations`: operational events, synthetics, incidents, and runbooks
4. `security`: threats, abuse controls, secrets, provenance, and privacy

One central integrator owns cross-lane contracts and validation. Independent
agents may own bounded packages within each lane after the shared contract is
stable.

Expected elapsed time: `10-18` days.

Gate `G5-02` owns repo-CLI proof for the exact merged commit's production
deployment plus live health/readiness/revision evidence. Development uses the
fast layered checks in `AGENTS.md`; substantial local batches receive one
pre-push Canonicalizer session, and an open green merge candidate receives one
GitHub-native Claude Opus review. Review loops and a separate attestation
service are deliberately outside the 1.0 critical path.

### Wave 3: Public Proof And Evidence Closure

Primary work:

1. public package and clean-install matrix
2. docs and agent-discovery crawl
3. reproducible external-agent demonstration
4. article, release notes, assets, and distribution sequence
5. one maintainer experience/story review
6. freeze candidate-matched public assets

Expected elapsed time: `5-10` days, overlapping late Wave 2 proof where safe.

### Wave 4: Candidate, Rehearsal, And Launch

Primary work:

1. cut one immutable candidate
2. run complete local and clean-checkout gates
3. obtain production approval and deploy the candidate
4. run production rehearsal, rollback, and degradation proof
5. make the final go/no-go decision
6. publish 1.0 and monitor stabilization

Expected elapsed time: `3-5` days plus the required stabilization window.

## Prior Stack Closeout

The roadmap, canonicalization, and external-agent stack from PRs `#52` through
`#60` was corrected and integrated through PR `#61` on 2026-08-30. That merge
landed the production-valid foundation; it was not the Air Jam 1.0 public
launch. Remaining release-program work proceeds as small, independently
production-valid pull requests under the canonical review and delivery gate.

## Incremental Delivery, Coordinated Launch

Air Jam should reach production incrementally while the stable 1.0 contract and
public announcement remain one exact-candidate event.

Before launch:

1. deploy coherent production-valid changes quietly and verify each terminal
   deployment
2. use Railway pull-request previews or a disposable release-candidate
   environment for infrastructure isolation unless Gate `G3-01` proves that a
   persistent staging environment is worth its recurring cost
3. publish exact candidate packages to the prerelease channel
4. submit and inspect hosted games as hidden releases
5. deploy the immutable release candidate before public traffic is invited and
   complete the live smoke, rollback, queue-pause, dependency-degradation,
   telemetry, alerting, and cost-control rehearsal
6. freeze public claims, screenshots, commands, versions, and links against that
   exact candidate

At launch, promote the already-proven package versions, public release
visibility, final documentation, article, and distribution sequence together.
No first deployment, untested migration, or new infrastructure topology belongs
in the HN launch action itself.

The current Railway snapshot has one persistent `production` environment with
three application services and Postgres healthy. Pull-request environments are
ephemeral and none were retained at the 2026-08-29 inspection. Gate `G3-01`
owns the measured decision about disposable candidate environments versus paid
always-on staging; prose here must not pre-commit recurring spend.

The old PR-52 hostname still returned platform health after Railway reported no
matching ephemeral environment. It is not a valid release target. Golden-path
automation therefore targets immutable Railway project/environment identities,
rejects the primary/base environment, and derives the platform deployment,
domain, environment-variable identity, Postgres instance, release-storage
isolation, and health attestation from provider state before starting an
external agent. A URL that merely looks like staging cannot authorize
publication.

## Remaining 1.0 Architecture

This section defines the implementation shape for the remaining program. It is
not a second work tracker: the readiness manifest remains the only authority for
item status, ownership, dependencies, and completion evidence. The sections
below explain how the remaining items fit together so independently developed
slices converge on one system rather than growing adjacent control planes.

Current counts, estimates, ownership, ready work, and blockers must always be
read from `pnpm --silent run repo -- readiness status --json` and `readiness
next --json`. They are intentionally not copied into this architecture section.

### One Operating Model

The remaining architecture is one evidence and control loop:

```text
domain/runtime/provider signal
  -> durable operational event
  -> source-owned synthetic and SLO evaluation
  -> deterministic incident correlation
  -> notification and GitHub issue projection
  -> runbook preview
  -> approved or allowlisted invocation
  -> bounded action
  -> independent verification
  -> resolve, roll back, or escalate
```

Recovery, capacity, security, and release evidence feed this loop; they do not
create separate automation systems. Product telemetry stays outside the loop
because visits and anonymous behavior are approximate product signals, not
authority for operational mutation.

The deployable topology remains deliberately small:

1. the platform web process owns product/API requests and application services
2. the realtime server owns room and controller runtime authority
3. the browser worker owns narrow untrusted-page browser execution
4. one operational worker owns durable background jobs, event delivery,
   synthetics, incident projection, and governed runbook execution
5. PostgreSQL owns durable coordination, leases, revisions, audit, and evidence
6. R2 owns immutable release/media bytes, while lifecycle and access policy stay
   in platform domain services

No new queue service, hosted scheduler, alerting database, admin-only dashboard
workflow, or second operations daemon should be added for 1.0. A measured limit
may later justify splitting the operational worker by workload, but every split
must keep the same PostgreSQL-backed authorities and contracts.

### Authority And Code Boundaries

The implementation should converge on these boundaries as each area is
touched:

1. `@air-jam/operations-contract` owns pure schemas, deterministic identity,
   redaction rules, state transitions, and machine-readable catalogs. It never
   reads a database, calls a provider, or decides deployment configuration.
2. `@air-jam/database-contract` and the platform schema remain the only physical
   database authority. Schema checks and migrations live here rather than in
   CLI-specific SQL.
3. platform operations services own transactional behavior: event delivery,
   SLO evaluation, incident correlation, retention, runbook state, and audit.
4. provider adapters translate GitHub, Railway, R2, and browser-worker responses
   into bounded domain results. They never own policy or persist raw provider
   payloads as incident documents.
5. worker composition owns cadence, concurrency, drain, and independent
   subsystem health. A failure in one cycle cannot starve unrelated checks or
   erase another subsystem's failure state.
6. the repo CLI, MCP, API, and future control-room UI remain thin clients of the
   same application services. Reads return stable redacted JSON. Mutations are
   preview-first and require explicit apply, actor, reason, idempotency, and the
   relevant revision or preview digest.
7. evidence artifacts record exact commands, versions, provider identities,
   timestamps, digests, and terminal outcomes; prose may interpret that
   evidence but never substitutes for it.

The operations area is already large enough that new work should not continue
growing the current flat files. Refactor along the boundary being changed—not
as an unrelated rewrite—toward this internal shape:

```text
apps/platform/src/server/operations/
  shared/       database time, redaction, lease and audit primitives
  events/       outbox, delivery, retention and producer boundaries
  reliability/ synthetic execution, SLO evaluation and alert state
  incidents/    correlation, evidence links, lifecycle and issue policy
  runbooks/     catalog, preview, invocation, action and verification
  integrations/ narrow GitHub, Railway, R2 and notification adapters
```

The public import remains one `@air-jam/operations-contract` package and the
machine surface remains under `pnpm run repo -- platform operations`. Internal
files may be split by contract family, but a file move alone is not a release
deliverable. The reason to split is to prevent the existing large contract,
synthetic-service, event-service, and platform-command modules from becoming
the next monoliths while Gate 4 is added.

### Reliability Foundation Corrections

Before continuous production activation, close the small trust gaps found by
the final reliability review in the same owning boundaries:

1. make the documented secret-key redaction vocabulary and the executable
   recursive filter exactly agree, including compound names such as API and
   signing keys without matching unrelated words accidentally
2. normalize an untrusted realtime failure code once and use the normalized
   value for both the retained failure and event kind
3. use database-authority timestamps for persisted synthetic chronology
4. isolate each due synthetic so one conflict or dependency error cannot starve
   the remaining catalog
5. serialize or fence SLO evaluation so a late result cannot regress breach or
   recovery streak state
6. add explicit retention for delivered outbox rows, operational events,
   synthetic runs, evaluations, alerts, incident evidence, and action audit
   without deleting evidence required by an open incident or unresolved action

Retention durations belong to the privacy and operating policy closed by
`G5-03`/`G5-04`; the cleanup implementation belongs to existing `G3-02` and
Gate 4 services. There must not be an undocumented delete loop or foreign-key
workaround.

### Production Migration Lifecycle (`G3-02`)

The schema drift discovered during the hosted-release cutover proved that a
healthy deployment is not enough evidence that production can use the merged
code. Database changes need one repo-owned lifecycle:

1. `inspect` reports the exact environment, database identity, applied journal
   head, source journal head, ordered pending migrations, and compatibility
   state without printing credentials
2. `plan` binds the intended migration set to the exact commit, environment,
   backup evidence, write-drain plan, and post-migration checks
3. `apply` requires the immutable plan digest, explicit production authority,
   actor, reason, and idempotency key; it drains the affected writers instead of
   stopping arbitrary provider services
4. `verify` proves the journal, required tables/invariants, service readiness,
   exact deployed revision, and worker compatibility before writes resume
5. a failed verification keeps the affected lane drained and produces a
   machine-readable recovery decision; migrations do not pretend to have a
   generic down path

Applications must report schema incompatibility through readiness while
liveness remains truthful. The operational worker must refuse to claim work
against an incompatible schema. Production migrations never run implicitly at
process startup.

The readiness manifest assigns this lifecycle and the operational-worker
activation proof to `G3-02`. The former non-critical suggestion has been removed
now that this work is part of the active release program.

### Capacity And Lifecycle Completion

`G3-02` finishes the existing production-control architecture rather than
introducing another limiter:

1. superseded unpublished release artifacts move through one durable lifecycle:
   active, warned, reclaimable, deleting, and tombstoned
2. published generations are never automatically reclaimed
3. warnings are persisted once and exposed through dashboard, API, CLI, and MCP
   from the same record; deletion cannot occur before the ratified warning and
   inactivity windows
4. the first deletion manifest remains immutable across partial failure and
   replay, preserving the quota and recovery behavior already implemented
5. PostgreSQL owns lightweight room and controller admission leases while the
   realtime process continues to own hot gameplay state
6. room create/join atomically checks lane state and the global, creator, game,
   room, and controller limits before reserving capacity
7. disconnect and graceful drain release or expire reservations predictably;
   a dead instance cannot hold capacity forever
8. overload rejects only new work with a stable reason and retry guidance;
   active rooms continue whenever technically safe

This must not change the player interaction model. Room codes, controller
joining, and gameplay remain visually identical below a limit. Admission and
permission enforcement are invisible in the healthy path and become explicit
only when the system genuinely cannot accept more work.

The operational-worker production rollout happens only after migration
compatibility, required synthetic targets, authenticated drain, secret scope,
lane controls, and rollback steps all pass preflight. Rollout order is:

1. inspect and migrate schema through the canonical lifecycle
2. create the worker service from `apps/platform/railway.worker.json`
3. provision only its declared least-privilege environment
4. start with mutation-heavy lanes paused and observe readiness
5. run one synthetic cycle and one safe job cycle manually
6. enable normal scheduling, observe at least one complete evaluation window,
   and measure the actual steady cost
7. retain a one-command drain/disable path and remove the service if it cannot
   stay within the existing budget and health contract

### Isolated Golden-Path Environment

`G2-03` should be unblocked by fixing environment isolation, not by weakening
the proof harness or allowing production credentials into an agent workspace.

Use an ephemeral Railway environment with a declared rehearsal profile:

1. distinct PostgreSQL instance and database identity
2. distinct R2 bucket with credentials incapable of reading or writing
   production objects
3. staging-only application identity, release tokens, callback origins, and
   provider variables
4. hidden publication only
5. provider-attested service, environment, domain, and variable-name identity
6. explicit expiry and cleanup for every run-owned external resource

The profile records resource identities and required variable names, never
secret values. The controller validates isolation before starting the external
agent and again before publication. After the Codex proof, Claude Desktop
repeats the discovery/session bootstrap, and `G2-05` repairs only friction found
by those real runs before the final replay.

Permanent always-on staging remains unjustified until rehearsal frequency or
measured setup cost proves it cheaper than ephemeral isolation.

### Recovery Model

`G3-03` should treat each data class according to whether it is authoritative or
derived:

| Data class                                      | Recovery authority                                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| PostgreSQL product and operations state         | Recurring provider backup plus timed isolated restore and invariant verification                         |
| Immutable uploaded release archives             | Object identity and digest verification; never rewritten in place                                        |
| Extracted hosted-release output and screenshots | Derived data rebuilt by replaying the exact generation-scoped job                                        |
| Managed creator media                           | Authoritative object plus database identity; restore/versioning behavior proved explicitly               |
| Product telemetry                               | Database restore and deterministic projection rebuild                                                    |
| Deployment binaries                             | Exact Git commit and provider deployment identity; roll back to the previous terminal-success deployment |

The canonical recovery surface should expose status, backup evidence, isolated
restore planning and verification, deployment rollback preview/apply, queue
pause/resume, and one-job replay. It should orchestrate provider capabilities
rather than build a second backup engine.

Recovery proofs must record recovery point, recovery time, data/invariant
checks, exact target isolation, and cleanup. A production database restore or
destructive data action remains human-approved; safe isolated drills are
autonomous.

### Incident And GitHub Issue Projection

`G4-03` adds durable incident state after the event store. It does not turn
GitHub into the source of truth.

The database model needs four explicit concepts:

1. an incident identified by the contract's deterministic fingerprint and
   protected by an optimistic revision
2. append-only evidence links from source events, alerts, synthetic runs, and
   provider attestations
3. recurrence and resolution history on the same fingerprinted incident
4. a specialized external-delivery outbox for issue/notification projections
   with lease, retry, dead-letter, and idempotency state

The correlator consumes each eligible source record exactly once through a
unique evidence identity. Volatile values such as timestamps, request IDs, and
messages never enter the fingerprint. A recurrence reopens the same incident;
it does not create a second issue.

GitHub delivery is a replaceable adapter. The initial adapter should use a
repository-installed GitHub App with issue-only permission, never a maintainer
personal token. A hidden incident marker and revision in the issue body make
create/update/reopen idempotent. Labels, title, severity, affected environment,
first/last occurrence, evidence references, and current runbook state are
projections from the incident. Human edits outside the owned block are
preserved.

The operational worker may receive only this narrow GitHub App identity for the
adapter. Platform web, realtime, browser worker, and creator-controlled code do
not receive it. External delivery failure leaves the incident intact and
retryable; it never rolls back source evidence.

For 1.0, do not add PagerDuty, Slack, or another paid incident platform merely
to complete a diagram. GitHub issues plus provider-native infrastructure alerts
are enough if the failure drills prove the roadmap's urgent-versus-digest
policy. The adapter boundary remains ready for another sink when actual use
justifies it.

### Governed Runbooks

`G4-04` implements the already-versioned runbook contract as a closed catalog,
not arbitrary shell execution.

Every runbook follows one state path:

```text
descriptor -> preview -> invocation -> actions -> verification
                                      -> rollback or escalation
```

Rules:

1. descriptors are source-owned and versioned
2. previews bind exact resources, current revisions, expected preconditions,
   proposed actions, expiry, cost/blast-radius bounds, and a digest
3. apply accepts only an unexpired matching preview and records actor,
   authority, reason, incident, and idempotency identity
4. actions use narrow typed adapters, never free-form commands or URLs
5. verification is independent from the mutation response
6. failed verification executes the declared bounded rollback when safe, then
   escalates once; it never loops indefinitely
7. every transition and before/after observation is append-only and available
   through the CLI/MCP surface

The initial catalog should stay intentionally small: pause/resume one expensive
lane, repair an expired lease, replay one idempotent failed job, restart one
unhealthy stateless service, and roll back one just-deployed stateless service
to its exact previous known-good deployment. Only actions proven by drills are
presented at `G4-05` for automatic allowlisting. Everything else remains
observe, diagnose, or recommend.

### Supply Chain, Privacy, And Emergency Release

`G5-03` closes trust around the bytes and guidance Air Jam publishes:

1. build public package tarballs once from an exact commit
2. validate those exact tarballs through the release matrix and public-export
   checks
3. record package digest, package graph, lockfile/toolchain identity, dependency
   inventory, and release manifest
4. pass the same tarballs to the trusted-publishing job and verify the registry
   integrity after publication
5. pin third-party workflow actions immutably and keep workflow permissions
   least-privileged
6. bind AI-pack and agent-guidance updates to immutable version/digest metadata
   with rollback protection before local files are changed
7. prove that privacy documentation matches actual ingestion, redaction,
   retention, deletion, and operator projection behavior
8. make the emergency path use the same reviewed, build-once, token-free
   publishing authority; urgency may shorten waiting, not change the identity of
   the bytes or bypass provenance

Railway's exact commit/deployment identity is sufficient for the 1.0 deployed
container proof unless a real requirement appears for a separately distributed
container image. Do not add a registry and signing service solely for ceremony.

### Remaining Security Closure

`G5-02` and `G5-03` close the ranked threat model through existing authorities,
not finding-specific middleware scattered around transports. The implementation
order should be:

1. finish observation, rollback, and legacy-host disposition for
   `games.air-jam.app`
2. close machine-token destination binding and host/controller grant authority
3. harden browser-worker authentication, resource bounds, and outbound-network
   policy
4. land realtime size/rate/admission work through the shared Gate 3 decision
   service
5. bound public reporting, protect reporter identity, and make takedown and
   quarantine complete across catalog and direct URLs
6. close provider-command targeting, redaction, replay, and audit gaps through
   the same preview/apply model
7. close package, AI-pack, privacy, retention, and emergency-release findings
   through the supply-chain work above

The threat-model register remains the finding authority. When proof closes a
finding, update its closure evidence and the owning readiness item in the same
change; do not copy the register into another checklist.

## Remaining Delivery Sequence

The sequence below expresses architectural dependency, not live status.
Readiness still determines what an agent may claim.

Blocks A through J are the current detailed sequence for the remaining work and
supersede the earlier broad wave ordering wherever the two differ. The wave
model remains useful only as historical program grouping.

| Delivery block                | Governing items                    | Production-valid outcome                                                                                           |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A. Reliability hardening      | `G3-02`, `G4-03`, `G5-02`          | Review gaps, retention semantics, schema compatibility, and module boundaries are safe before continuous execution |
| B. Production controls        | `G3-02`, `G5-02`                   | Artifact retention and invisible realtime admission complete; operational worker has a safe activation contract    |
| C. Isolated external proof    | `G2-03` through `G2-05`            | Codex and Claude Desktop prove the public lifecycle without production authority or maintainer intervention        |
| D. Recovery proof             | `G3-03`                            | Recurring backup, isolated restore, deployment rollback, lane pause/resume, and job replay have measured evidence  |
| E. Incident projection        | `G4-03`                            | One confirmed symptom becomes one maintained incident and GitHub issue                                             |
| F. Supply-chain trust         | `G5-03`                            | Exact validated package bytes, provenance, privacy, and emergency release are proven                               |
| G. Governed remediation       | `G4-04` through `G4-06`            | Typed runbooks preview, execute, verify, roll back, and escalate under the approved allowlist                      |
| H. Scale and security closure | `G3-04`, `G3-05`, `G5-02`, `G5-04` | Capacity, degradation, residual security risk, recovery time, and the honest support envelope close                |
| I. Public proof               | `G6-02` through `G6-06`            | Docs, discovery, demo, article, release notes, and assets match shipped behavior                                   |
| J. Candidate and launch       | `G7-01` through `G7-06`            | One immutable candidate is rehearsed, approved, launched, observed, and recorded                                   |

After block A stabilizes shared contracts, C, D, E, and F may proceed in
parallel. G waits on E because runbooks act on incident authority. H waits on
the controls and recovery work because load and failure drills must exercise the
real final mechanisms. I can begin from proven golden-path evidence but freezes
only after operational and security behavior is settled.

### Pull Request Shape

Prefer reviewable, independently deployable pull requests in this order:

1. reliability trust corrections and touched-module extraction
2. `G3-02` migration inspect/plan/apply/verify lifecycle
3. artifact retention and realtime admission
4. operational-worker provisioning and observed activation
5. isolated rehearsal profile and primary external-agent proof
6. backup/restore/rollback/replay surface and drill
7. incident persistence/correlation, then GitHub delivery
8. package build-once/provenance and privacy/emergency proof
9. runbook persistence/execution, then allowlist drill
10. remaining security closure and capacity/degradation proof
11. public demo/docs/story and exact release candidate

Split a listed pull request further when it crosses unrelated authority or
becomes difficult to review. Do not split one invariant across PRs in a way that
leaves production with a bypass, two active paths, or a schema its running code
cannot understand.

Normal development keeps the established fast loop. A substantial multi-file
batch gets one Canonicalizer pass before push. One open, green, merge-ready PR
gets one GitHub-native Opus review. Merge only after required CI, review
comments, preview/provider checks, and migration compatibility are clear.
Production delivery is complete only when every affected service reaches
terminal success and live health/readiness/revision evidence matches the merged
commit.

### Deliberate Non-Goals

The remaining work must not expand into:

1. a hosted general-purpose AI editor
2. a Kubernetes, Kafka, or microservice migration
3. multi-region or multi-replica realtime before one-replica evidence demands it
4. a custom backup engine
5. generic arbitrary-code remediation
6. automatic production code merge or promotion
7. a paid alerting platform without measured need
8. a second task tracker, incident truth store, provider control plane, or
   dashboard-only operating path

These boundaries keep the architecture complete without confusing maturity
with infrastructure count.

## Parallel Execution Rules

1. shared contract work stays central until its boundary is stable
2. one work item has one owner
3. agents claim before editing and release ownership only by completing or
   blocking the item
4. parallel work should use disjoint subsystem ownership whenever practical
5. cross-lane contract changes return to the central integrator
6. integrate at least daily during active parallel work rather than accumulating
   long-lived divergent branches
7. run focused checks inside a package and broader checks at integration points
8. do not let a parallel lane create a competing runtime, telemetry, incident,
   quota, release, or deployment authority

## Progress Interpretation

`readiness status` reports:

1. work-item counts by state
2. estimate-weighted progress
3. remaining agent-hour range
4. gate-level status
5. currently ready authority classes
6. active blockers

Estimate-weighted progress is a scheduling signal, not gate completion. A gate
is closed only when its roadmap evidence is complete.

Avoid false precision:

1. estimates should change only when an audit materially changes known scope
2. work discovered inside an existing gate should be added as a manifest item,
   not hidden inside a note
3. product expansion requires a roadmap decision before it enters the program
4. non-critical post-1.0 work belongs in `docs/suggestions.md`, not this
   manifest

## Current Starting State

The initial manifest deliberately marks implementation items pending rather
than declaring inferred completion from old work.

The first autonomous queue contains independent work in:

1. Gate 0 decision-packet preparation
2. Gate 1 architecture audit
3. Gate 3 production capacity and recovery inventory
4. Gate 5 threat modeling

Existing capability is evidence that should make these packages faster. It is
not automatically accepted as 1.0 proof until the package verifies it against
the current roadmap.

## Completion Rule

This execution plan is complete when:

1. every manifest work item is complete with valid evidence
2. every roadmap gate is explicitly closed
3. 1.0 has been published and the stabilization outcome is recorded
4. `docs/current-state.md` and `docs/work-ledger.md` contain the final truth
5. this plan is moved to `docs/archive/` with a date-first filename
6. the active machine program is retired or replaced without leaving two
   competing trackers

The plan does not close because the estimated hours elapsed or because a launch
date arrived.
