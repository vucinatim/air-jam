# Air Jam 1.0 Release Execution Plan

Last updated: 2026-08-29
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

1. `artifact:` generated proof retained locally or in CI
2. `command:` a deterministic validation or terminal operation
3. `decision:` an explicit maintainer or ratified program decision
4. `document:` a repo document containing the durable result
5. `url:` a stable external result such as a deployment, workflow, issue, or
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

## Current Stack Closeout And Merge Policy

The 2026-08-28 through 2026-08-29 roadmap, canonicalization, and external-agent
work was intentionally reviewed as pull request stack `#52` through `#60`.
Independent review then produced corrections that cross the original slice
boundaries and now live on the cumulative top of the stack.

The production-valid closeout is therefore:

1. close the remaining correctness, trust, and release-safety findings on the
   cumulative branch
2. create one integration pull request from the corrected cumulative head into
   `main`, linking the component pull requests as its review record
3. run the complete CI and release-relevant gate on that exact integration head
4. satisfy the repository's formal approval policy or record an explicit
   maintainer decision changing an approval policy that a solo repository
   cannot satisfy; automated issue comments are not formal approvals
5. merge once and verify the resulting production deployment and health rather
   than intentionally deploying known-incomplete intermediate stack states
6. close the component pull requests as superseded only after the cumulative
   merge is retained on `main`
7. resume small, independently production-valid pull requests for the remaining
   release program

This integration is not the Air Jam 1.0 public launch. It lands the corrected
foundation from which Gates 2 through 7 continue.

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
