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

The readiness manifest owns the live agent-hour, maintainer-hour, and calendar
planning envelope. Read it through `readiness status --json`; this plan does not
copy those changing totals. The aggressive case assumes parallel execution and
little audit fallout, while the conservative case includes a real redesign
discovered by reliability, security, or scale proof.

This is scheduling guidance, not completion evidence. The program closes only
through the roadmap gates.

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

Maintainer judgment is intentionally concentrated into five checkpoints:

1. `G0-03`: product, naming, compatibility, budget, quota, and autonomy
   decisions
2. `G1-04`: public compatibility changes and high-impact removals
3. `G5-04`: residual security risk acceptance
4. `G6-05`: final social experience, demonstration, and public story
5. `G7-04`: final go/no-go

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

These broad waves preserve the original program grouping. For current remaining
work, the more detailed [Remaining Delivery Sequence](#remaining-delivery-sequence)
supersedes their ordering wherever the two differ.

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
3. `operations`: operational events, synthetics, alerts, agent diagnosis, and
   narrow GitHub issue projection
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

### Deployment And Authority Topology

The remaining implementation follows the canonical
[agent operating ecosystem](../working-agreements.md#agent-operating-ecosystem)
and
[effect-authority rubric](../working-agreements.md#agent-freedom-and-operational-authority).
This plan owns only the concrete 1.0 deployment and authority shape.

Authority remains where the truth originates:

1. Railway owns deployment and provider state
2. Air Jam owns application, runtime, release, and operational evidence
3. GitHub issues and pull requests own durable collaboration and delivery
   history
4. readiness owns release-program dependencies, claims, and completion evidence
5. local agents own diagnosis, planning, implementation, and collaboration

The deployable topology remains deliberately small:

1. the platform web process owns product/API requests and application services
2. the realtime server owns room and controller runtime authority
3. the browser worker owns narrow untrusted-page browser execution
4. one operational worker owns durable background jobs, event delivery,
   synthetics, alert evaluation, retention, and narrow GitHub issue projection
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
   SLO evaluation, alert state, retention, and mutation audit where a current
   production action requires it.
4. provider adapters translate GitHub, Railway, R2, and browser-worker responses
   into bounded domain results. They never own policy or persist raw provider
   payloads as application-owned documents.
5. worker composition owns cadence, concurrency, drain, and independent
   subsystem health. A failure in one cycle cannot starve unrelated checks or
   erase another subsystem's failure state.
6. the repo CLI, MCP, API, and future control-room UI remain thin clients of the
   same application services. Reads return stable redacted JSON. Mutations carry
   only the safeguards justified by their authority and blast radius under the
   working-agreements rubric.
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
  integrations/ narrow GitHub issue, Railway, R2 and notification adapters
```

The public import remains one `@air-jam/operations-contract` package and the
machine surface remains under `pnpm run repo -- platform operations`. Internal
files may be split by contract family, but a file move alone is not a release
deliverable. The reason to split is to prevent the existing large contract,
synthetic-service, event-service, and platform-command modules from becoming
the next monoliths while Gate 4 is added. Do not pre-create `incidents/`,
`runbooks/`, or another abstraction directory until real implementation has a
distinct authority and more than one concrete consumer.

### Local Agent Loop And Sensory Model

The governing freedom, authority, and swarm policy remains solely in the
[agent operating ecosystem](../working-agreements.md#agent-operating-ecosystem).
For 1.0, local agents may enter from a periodic `/loop`, GitHub or provider
signal, or explicit maintainer prompt. This section maps those agents onto the
concrete Air Jam surfaces and defines the proof they must be able to complete.

#### Sensory Sources

Following the authority ownership defined above, the concrete inspection map
is:

| Question                                            | Canonical source                                                                              | Durable coordination or evidence                                                    |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Is the product behavior healthy?                    | Air Jam reliability status, synthetics, SLOs, alerts, runtime state, and structured logs      | Operational event, synthetic run, SLO evaluation, and alert records                 |
| Is the infrastructure and exact deployment healthy? | Repo-owned Railway commands over provider deployments, logs, metrics, health, and variables   | Provider identity and bounded evidence reference, not a copied raw provider payload |
| Is code delivery healthy?                           | GitHub checks, reviews, pull requests, and deployment status                                  | Pull request, review, check, and exact commit history                               |
| What release work is owned or dependency-ready?     | Readiness status, next, inspect, and claim commands                                           | Canonical readiness manifest and typed completion evidence                          |
| Can a defect be reproduced and evaluated locally?   | Git state, layered checks, unified dev logs, browser proof, and semantic game-session actions | Regression test, screenshot/log artifact, branch, and pull request                  |
| Is cost or capacity approaching a boundary?         | Railway usage evidence plus Air Jam budget, quota, queue, and admission state                 | Immutable budget evidence and source-owned policy decision                          |

Do not ingest all provider data into Air Jam merely to make it searchable. A
stable pointer plus the small correlation spine below is enough until repeated
cross-provider investigations prove that a richer projection is needed.

#### Correlation Spine

Machine-readable inspection and retained evidence should expose these
identities when the source owns them:

1. environment and authoritative component or service
2. exact Git revision and provider deployment identity
3. `alertKey`, alert revision, event ID, and synthetic or SLO identity
4. bounded trace, request, room, runtime, release, or job identity when relevant
5. evidence reference and observation time from the owning authority
6. related readiness item, GitHub issue, branch, or pull request when one exists

Missing identities remain explicitly absent; adapters must not invent them.
Raw logs, secrets, credentials, untrusted exception text, and creator-controlled
payloads never become correlation fields. This spine should be added to the
existing status and evidence projections as their owning slices are touched,
not through a second universal event format.

#### Cold-Start Agent Proof

Given the repository and one maintained alert issue but no undocumented
operator knowledge, a fresh local agent must demonstrate these capabilities.
It does not have to reason in this order:

1. **Discover and notice**: find the relevant commands through repo help and
   canonical docs, then inspect the durable alert, provider/deployment signal,
   GitHub activity, scheduled observation, or maintainer report.
2. **Orient cheaply**: inspect readiness, Air Jam reliability, the exact
   deployment, and relevant GitHub state before opening broad logs or running
   expensive checks.
3. **Investigate freely**: correlate current source truth, reproduce locally,
   inspect code and history, and form or discard hypotheses without taking a
   claim or requesting approval.
4. **Coordinate only when useful**: claim a readiness item for planned release
   work, use the maintained alert issue for shared operational work, and use a
   branch or pull request for code. Pure observation needs no ownership record.
5. **Choose the smallest effective action**: prefer a local fix or existing
   focused repair, replay, pause, rollback, or provider action. Production
   effects follow the authority bands in the working agreements.
6. **Verify independently**: do not use a command's successful return as its
   own proof. Re-read health, state, deployment identity, invariants, or the
   user story through a separate query or synthetic.
7. **Retain signal, not narration**: update the existing issue, PR, readiness
   evidence, or operational audit with the outcome and exact references. Do not
   create a parallel agent diary or copy transient investigation chatter into
   application state.
8. **Stop cleanly**: when authority, ambiguity, repeated failure, or blast
   radius exceeds the available boundary, leave a concise escalation bundle
   containing current state, checked evidence, attempted effects, terminal
   outcome, and the exact decision or authority needed next.

This proof tests the ecosystem while leaving the agent free to choose its own
reasoning path.

#### 1.0 Coordination Mapping

Existing surfaces provide enough coordination for 1.0:

1. one alert key maintains one GitHub issue as the operational rendezvous
2. issue assignment and comments expose active human or agent ownership when
   shared coordination is useful
3. readiness claims prevent two agents from silently implementing the same
   planned release item
4. branches and pull requests expose code ownership, review, and integration
5. database leases, idempotency keys, and optimistic revisions protect actual
   jobs and production mutations

The working agreements remain the sole authority for when a new coordination
primitive becomes justified.

### Reliability Foundation Corrections (`G4-07`, `G3-07`)

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
   synthetic runs, evaluations, alerts, and production-action audit without
   deleting evidence referenced by an open alert, issue, or unresolved action

The first five corrections belong to the separately claimable `G4-07` item.
Retention durations belong to the privacy and operating policy specified by
`G5-03` and included in the residual-risk review at `G5-04`; the cleanup
implementation is the separately claimable `G3-07` item, depends on `G5-03`,
and reuses the existing Gate 4 services. There must not be an undocumented
delete loop or foreign-key workaround.

Implement `G4-07` in three reviewable batches that preserve one architecture:

1. **Trust boundary**: centralize the executable redaction vocabulary and
   normalize untrusted failure codes at ingestion. Prove nested and adversarial
   payloads, not only expected examples.
2. **Chronology and concurrency**: make persisted synthetic time database-owned,
   isolate each due check, and protect SLO state with the existing database
   authority and revision model. Do not add another lock service.
3. **Agent-facing proof and touched-module cleanup**: prove stable redacted JSON,
   exact correlation identities, partial synthetic failure, concurrent stale
   evaluation rejection, and continued execution of unrelated checks. Split
   touched flat modules only where the resulting domain boundary is real.

`G4-07` is complete when malformed input cannot leak secret-shaped data or
create inconsistent failure identity, one broken synthetic cannot starve the
catalog, an older evaluation cannot regress newer alert state, all persisted
chronology is authority-consistent, and an agent can explain those outcomes
through the canonical machine surface.

### Production Migration Lifecycle (`G3-06`)

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

The readiness manifest carries this lifecycle as `G3-06` and the separate
operational-worker activation proof as `G3-08`, each with its own estimate,
dependencies, and evidence requirements. The former non-critical suggestion has
been removed now that this work is part of the active release program.

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

The `G3-08` operational-worker production rollout happens only after migration
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

### Alert And GitHub Issue Projection

`G4-03` connects trustworthy operational evidence to the shared surface where
local agents can notice, coordinate, and act. It does not build a second generic
incident system.

For 1.0, the existing durable `alertKey` and revision provide the issue
identity. The narrow projection needs only:

1. one idempotent issue-delivery record keyed by `alertKey` and target
   repository
2. links to the relevant source events, synthetic runs, deployment identity,
   and provider evidence rather than copied raw payloads
3. create, update, reopen, and resolve behavior that preserves human-authored
   text outside the adapter-owned block
4. bounded retry and visible delivery failure without rolling back the source
   alert

The adapter-owned issue block should make the cold-start path obvious without
turning the issue into application truth. It renders the issue-relevant subset
of the correlation spine defined above, plus current status and recovery or
failed-verification evidence. One stable machine-discoverable label marks these
maintained operational issues. Human and agent discussion stays outside the
managed block.

Volatile values such as timestamps, request IDs, and message text never enter
the issue identity. A recurrence under the same `alertKey` updates or reopens
the same issue rather than creating a duplicate.

The adapter uses a repository-installed GitHub App with issue-only permission,
never a maintainer personal token. The operational worker is the only Air Jam
service that receives that identity. Platform web, realtime, browser worker,
and creator-controlled code do not receive it.

GitHub is shared coordination and memory, not application truth. Agents may use
the issue as a durable rendezvous point, then inspect current truth directly
from Railway, Air Jam operations, logs, tests, and the local repository. A
separate incident lifecycle becomes justified only when real incidents need
ownership, recurrence, evidence, or resolution behavior that the alert plus
issue cannot express cleanly.

For 1.0, do not add PagerDuty, Slack, or another paid incident platform merely
to complete a diagram. GitHub issues plus provider-native infrastructure alerts
are enough if the failure drills prove the roadmap's urgent-versus-digest
policy.

Implement `G4-03` as one vertical path:

1. persist an idempotent projection record over the existing `alertKey`
2. add one issue-only GitHub App adapter with bounded inputs and outputs
3. let the existing operational worker create, update, reopen, and resolve the
   issue without blocking internal alert progress
4. prove retries, recurrence, recovery, preserved discussion, and permission
   failure against an isolated repository or equivalent provider fixture
5. run the cold-start agent proof from the maintained issue

Do not add general notification routing, incident assignment state, or an
arbitrary webhook framework as part of this vertical slice.

### Emergent Remediation After 1.0

Smart looping agents can already use the focused Air Jam, Railway, GitHub, and
local tools to diagnose a problem, implement a fix, open a reviewed pull
request, roll back a deployment, or invoke an existing bounded recovery
command. That is the intended first self-healing model.

Do not build a generic runbook persistence or automatic-remediation engine for
1.0. When repeated real incidents reveal a stable recovery pattern, extract
the smallest shared typed action from the proven agent workflow. If automatic
execution later becomes worthwhile, it must bind exact resources, authority,
cost and blast-radius limits, idempotency, independent verification, and a
finite rollback or escalation path. The current operations contract preserves
that future vocabulary without requiring its entire state machine to be
deployed now.

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

Blocks A through I are the current detailed sequence for the remaining work and
supersede the earlier broad wave ordering wherever the two differ. The wave
model remains useful only as historical program grouping.

| Delivery block                | Governing items                    | Production-valid outcome                                                                                                   |
| ----------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| A. Reliability hardening      | `G3-06`, `G4-07`, `G5-02`          | Review gaps, schema compatibility, and module boundaries are safe before continuous execution                              |
| B. Production controls        | `G3-02`, `G3-07`, `G3-08`, `G5-03` | Artifact and evidence retention plus invisible realtime admission are complete; the operational worker is activated safely |
| C. Isolated external proof    | `G2-03` through `G2-05`            | Codex and Claude Desktop prove the public lifecycle without production authority or maintainer intervention                |
| D. Recovery proof             | `G3-03`                            | Recurring backup, isolated restore, deployment rollback, lane pause/resume, and job replay have measured evidence          |
| E. Alert and issue projection | `G4-03`                            | One confirmed actionable alert key maintains one GitHub issue with linked evidence                                         |
| F. Supply-chain trust         | `G5-03`                            | Exact validated package bytes, provenance, privacy, and emergency release are proven                                       |
| G. Scale and security closure | `G3-04`, `G3-05`, `G5-02`, `G5-04` | Capacity, degradation, residual security risk, recovery time, and the honest support envelope close                        |
| H. Public proof               | `G6-02` through `G6-06`            | Docs, discovery, demo, article, release notes, and assets match shipped behavior                                           |
| I. Candidate and launch       | `G7-01` through `G7-06`            | One immutable candidate is rehearsed, approved, launched, observed, and recorded                                           |

After block A stabilizes shared contracts, C, D, E, F, and the independent
control work inside B may proceed in parallel. B finishes only after F ratifies
the retention policy, because production activation must exercise the final
cleanup behavior. G waits on the controls and recovery work because load and
failure drills must exercise the real final mechanisms. H can begin from proven
golden-path evidence but freezes only after operational and security behavior
is settled. Everything after `G7-01` proceeds only from the exact candidate
that `G7-01` freezes.

### Pull Request Shape

Prefer reviewable, independently deployable pull requests in this order:

1. `G4-07` reliability trust corrections and touched-module extraction
2. `G3-06` migration inspect/plan/apply/verify lifecycle
3. `G3-02` artifact retention and realtime admission, then `G3-07` operational
   evidence retention after its policy is ratified
4. `G3-08` operational-worker provisioning and observed activation
5. isolated rehearsal profile and primary external-agent proof
6. backup/restore/rollback/replay surface and drill
7. narrow alert-key GitHub issue projection
8. package build-once/provenance and privacy/emergency proof
9. remaining security closure and capacity/degradation proof
10. public demo/docs/story and exact release candidate

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
8. a second task tracker, generic incident truth store, provider control plane,
   or dashboard-only operating path
9. a mandatory runbook state machine or swarm scheduler before observed usage
   proves that focused tools, claims, issues, and agent loops are insufficient

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
