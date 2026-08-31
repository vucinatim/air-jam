# Working Agreements

Last updated: 2026-08-31
Status: stable operating rules

This file defines how humans and agents should use the Air Jam repo operating system.

Its purpose is:

1. faster orientation
2. lower ambiguity
3. fewer doc-role conflicts
4. cleaner phase closure

This file should stay stable and low-churn.

## Read Order

When starting work, prefer this order:

1. [../README.md](../README.md)
2. [docs-index.md](./docs-index.md)
3. [current-state.md](./current-state.md)
4. [documentation-taxonomy.md](./documentation-taxonomy.md)
5. the relevant active plan
6. the canonical machine execution state when the active plan defines one
7. [work-ledger.md](./work-ledger.md) only if historical context is needed

Agents should not need to scan the ledger before they can tell what matters now.

## Agent Operating Loop

Use this loop unless a task clearly requires something more specific:

1. orient from:
   1. `README.md`
   2. `docs/docs-index.md`
   3. `docs/current-state.md`
2. open only the relevant active plan
3. inspect the plan's canonical machine execution state when one exists
4. claim one dependency-ready work item
5. work inside the current ownership boundaries
6. validate the intended slice and retain evidence
7. complete or block the claimed item explicitly
8. continue another independent ready item rather than waiting unnecessarily
9. update docs only where the rules below require it
10. explicitly close the phase if the slice is actually complete

If an agent jumps from chat context straight into edits without checking the current repo surfaces, it is operating incorrectly.

## Review Stacks And Integration

Stacked pull requests are review slices, not permission to merge a knowingly
incomplete intermediate state to `main`.

Use these rules:

1. merge a stack bottom-up only when every slice is independently production
   valid, green, and has its own review findings resolved
2. resolve the pull request's full `baseRefOid` and `headRefOid` from GitHub
   immediately before each review and again immediately before merge; do not
   reconstruct or transcribe full SHAs from abbreviated commit names
3. run Canonicalizer on every meaningful commit batch as defined below
4. resolve every actionable Canonicalizer finding and resume the same session
   until `ready`
5. request Claude Opus 5 through the explicit provider selector
   `claude-opus-5`, not the moving `opus` alias, and configure no fallback;
   the result is valid only when its `modelUsage` records `claude-opus-5` as the
   requested reviewer model; a successor model replaces Opus 5 only through an
   explicit change to this canonical policy; keep the review read-only and ask
   it to inspect correctness, architecture, canonicality, security, operations,
   tests, and documentation
6. review every individual pull request independently; a cumulative or
   descendant review does not review its ancestors
7. after any base or head change, treat both agent reviews and any formal
   approval as stale and rerun or re-obtain them against the new exact
   base-to-head state before merge
8. attach both reviews to the pull request with the exact reviewed base and head
   SHAs, Canonicalizer session identifier, resolved Claude `modelUsage` model
   identifier, verdicts, and resolved findings so later agents can audit what
   was actually reviewed
9. when review corrections cross stack boundaries, prepare one cumulative
   integration pull request from the corrected top of the stack into `main`
10. preserve the component pull requests as focused review history and close
    them as superseded only after the integration pull request merges
11. run the complete integration gate against the exact cumulative head; green
    checks on a descendant do not retroactively make a failing ancestor safe to
    merge by itself
12. treat provider preview status, issue comments, and automated review prose as
    evidence, not as a formal GitHub approval unless GitHub records an approving
    review
13. merge only when all exact-base-and-head evidence is attached: Canonicalizer is
    `ready`; the required Claude review has no actionable blockers; every
    configured GitHub Actions workflow expected by its event and path rules has
    a check run whose required jobs are `SUCCESS`; every provider-created
    preview deployment for that exact base and head is literal terminal
    `SUCCESS`; every review conversation is resolved; and GitHub records a
    formal approving review whose commit matches the head; branch protection's
    required-context list is a floor, not the full definition of this gate
14. list the affected deployable services and exact preview deployment IDs in
    the pull request evidence; provider deployment state is the positive preview
    proof, while a green or warning-only preview-comment workflow is not; when
    no preview is created, record why the diff cannot affect a deployable
    artifact or treat the missing provider deployment as a blocker
15. never use an admin bypass to evade an unsatisfied required check, review,
    preview, or conversation-resolution rule; if a solo repository cannot
    satisfy formal approval, stop and obtain a trusted reviewer identity rather
    than reinterpreting agent evidence as approval
16. require branch protection to dismiss stale approvals and apply required
    checks and reviews to administrators; a visible approval or green status
    from a different base or head does not satisfy the gate
17. after a cumulative integration, return to small independently mergeable pull
    requests rather than allowing another long-lived stack to become the normal
    delivery model

A Canonicalizer batch is the exact contiguous range from the pull request base,
or the last Canonicalizer-ready head on that branch, through the current head;
it must include every unreviewed commit. A meaningful batch changes runtime
behavior, public or machine contracts, architecture or ownership, security or
privacy, data or schemas, infrastructure, dependencies, deployment behavior,
release operations, or the structural documentation that governs those
systems. Formatting-only and typo-only edits do not require their own
intermediate pass before review begins, but rule 7 is unconditional once review
evidence exists and the final ready range must include those commits.

## Production Delivery And Public Launch

Merging production-ready code and announcing Air Jam 1.0 are separate events.

1. every merge to `main` must be safe to deploy and operate without depending
   on an unpublished future merge
2. deploy coherent changes incrementally and verify their terminal production
   state instead of holding all implementation for launch day
3. exercise public packages through exact tarballs and the prerelease channel
   before promoting those versions to `latest`
4. exercise hosted games as hidden releases before making them visible in the
   public Arcade
5. cut one immutable candidate only after the preceding release gates close,
   deploy that exact candidate before announcing it, and retain live smoke,
   rollback, degradation, observability, and cost evidence
6. coordinate stable package promotion, public release visibility, final docs,
   the launch article, and distribution as one explicit launch sequence
7. prefer disposable release-candidate or preview infrastructure until measured
   evidence justifies paying for an always-on staging environment
8. never describe a queued deployment as deployed; terminal provider success
   and post-deploy health are required evidence
9. after merge, identify the exact merged commit in provider deployment state,
   wait for literal terminal `SUCCESS`, and verify live health, readiness, and
   revision evidence before calling the production rollout complete
10. if that exact deployment fails, preserve the failed attempt as incident
    evidence and recover it before merging unrelated work; an older successful
    deployment still serving traffic does not make the new rollout successful
11. start Railway verification with
    `pnpm --silent run repo -- railway doctor --project <id> --json`; until the
    `G5-02` exact-commit verifier is required in automation, run
    `railway deployment list --project <project-id> --environment <environment-id> --service <service-id> --json`
    for every affected service, select the deployment whose `meta.commitHash`
    equals the merged commit, and retain its deployment ID and literal terminal
    status rather than inferring identity from service health

## Agent-First Operability

Air Jam treats agent operation as a product contract, not an internal
convenience.

A new operator capability is complete only when:

1. agents can discover it through the repo CLI, MCP, or another canonical
   machine-readable contract
2. agents can inspect current state and health without scraping a UI
3. the supported lifecycle, including safe maintenance and repair, is available
   through that contract
4. structured reads have stable JSON output; machine consumers invoke repo
   commands through `pnpm --silent run repo -- ... --json` when stdout must be
   the JSON document alone
5. mutations are explicit, safe to automate, and share domain logic with the UI
6. tests and docs cover the machine path

The canonical repo entrypoint is `pnpm run repo -- --help`. Agents should prefer
repo-owned commands over ad hoc SQL, browser-only operation, or provider-specific
shell sequences whenever the repo CLI owns the job.

For the active 1.0 program, use:

```bash
pnpm --silent run repo -- readiness status --json
pnpm --silent run repo -- readiness next --json
```

Claim, block, and complete work through `readiness update`. Mutations are
read-only previews unless `--apply` is explicit.

## Doc Roles

### `README.md`

Use for:

1. repo identity
2. primary command surface
3. top-level app and package shape
4. outward links

Do not use it as the main current-state tracker.

### `docs/docs-index.md`

Use for:

1. navigation
2. read order
3. active plan and planned next pointers
4. core docs vs archive split
5. pointers into the live docs taxonomy

### `docs/current-state.md`

Use for:

1. current focus
2. what is done
3. what is open
4. immediate next steps
5. the small set of plans that currently govern work

Update only at:

1. phase closures
2. real reprioritizations
3. repo operating system changes

Do not update it for every minor implementation step.

### `docs/work-ledger.md`

Use for:

1. append-only historical progress
2. milestone closures
3. major validations
4. notable decisions worth preserving in time order

Do not use it as the main quick-read status file.

### `docs/working-agreements.md`

Use for:

1. stable operating rules
2. read order
3. doc roles
4. update rules
5. phase-close ritual

### Plan Docs

Use plan docs for:

1. direction
2. execution sequence
3. boundaries
4. close gates
5. stop rules

### Machine Execution Programs

Use a machine execution program only when a large active plan benefits from
dependency-aware autonomous scheduling.

It owns:

1. work-item state and ownership
2. dependencies and ready-work derivation
3. estimates and blockers
4. typed evidence references
5. explicit human and production checkpoints

It does not own product scope or duplicate the plan narrative. The plan remains
the product authority, and the repo CLI remains the supported mutation surface.

### Vision And Strategy Docs

Use these docs for:

1. long-horizon product direction
2. architecture explanation
3. public positioning
4. future-state intent

Do not use a vision or strategy doc as a substitute for an executable plan.

Use:

1. [vision.md](./vision.md) and [discoverability-vision.md](./discoverability-vision.md) for long-horizon direction
2. `docs/strategy/` for the stable strategy and workflow surface

### Capability And Reference Docs

Use:

1. [capability-inventory.md](./capability-inventory.md) for the current implemented surface
2. `docs/architecture/` for stable subsystem architecture docs
3. `docs/contracts/` for stable runtime and shell contracts
4. `docs/guides/` for stable migration and implementation guides

Keep these reference-oriented.
They should clarify what exists and how it is shaped, not become active trackers.

### Live Content Drafts

Use:

1. `docs/content/` for the public-facing draft surface

Keep content drafts separate from plans and archive old outlines instead of mixing them into the live writing surface.

### Documentation Taxonomy

Use:

1. [documentation-taxonomy.md](./documentation-taxonomy.md) for category meanings and naming rules

### `docs/suggestions.md`

Use for:

1. durable non-critical follow-ups
2. architecture cleanup ideas
3. future improvements that are not the current execution path

Do not turn it into a second active tracker.

## What Not To Touch Casually

Do not casually:

1. rewrite `docs/current-state.md` for minor progress updates
2. use `docs/work-ledger.md` as a live dashboard
3. create a new top-level doc type without a clear role
4. keep completed plans mixed into the active plan surface
5. treat a future-facing vision doc like a current execution plan
6. let one temporary sprint document become a permanent repo surface

## Active Plan Lifecycle

Every real plan should be treated as one of:

### Active Plan

Small set only.

Target:

1. one to three governing plans
2. one conditional fallback implementation plan at most

These define what work should happen now.

### Planned Next

Short queue of real next phases.

These matter, but they should not govern the current implementation pass.

### Completed

Completed plans should no longer compete with active work.

They may remain useful as execution history or architecture record, but they should be archived or clearly marked as non-current.

Archive them before moving the repo's main execution focus elsewhere.

Use the archive filename rule:

1. `YYYY-MM-DD-semantic-name.md`

## Phase-Close Ritual

A phase should be considered closed only when all of the following are true:

1. the implementation is complete enough for the intended slice
2. the intended validation has passed
3. the meaningful result is appended to the ledger
4. `current-state.md` reflects the new current snapshot
5. active plan and planned next surfaces are adjusted if needed
6. completed plans are archived or clearly removed from the active surface
7. archived plans are renamed into the date-first archive format if they are not already

If those steps are not done, the phase is not really closed.

## Update Rules

### Update `current-state.md` when:

1. the current focus changes
2. an active phase closes
3. a different plan becomes the real governing plan

### Update `work-ledger.md` when:

1. a phase closes
2. a meaningful validation passes
3. a durable repo-shape or architecture milestone lands

Append. Do not rewrite history for convenience.

### Update `docs/docs-index.md` when:

1. read order changes
2. a new active plan or planned next item becomes important
3. a new reference doc becomes part of the normal operating surface

### Update `docs/archive/` when:

1. a plan stops governing current work
2. a completed or superseded snapshot should be preserved
3. a preserved snapshot still has a non-chronological archive filename

### Update `README.md` when:

1. repo identity changes
2. primary commands change
3. the top-level entry path for contributors changes materially

## Expansion Rules

When adding a new capability, system, or repo operating system surface:

1. if the work is still exploratory, start with a vision or strategy doc
2. once the work is meant to execute, write or update a plan doc
3. classify it as:
   1. active now
   2. planned next
   3. completed
4. keep the active set small
5. close it with the phase-close ritual

## Multi-Human / Multi-Agent Rule

To reduce conflicts:

1. keep the current snapshot in `docs/current-state.md`
2. keep history in `docs/work-ledger.md`
3. keep active plans bounded and explicit
4. do not invent parallel status surfaces in ad hoc docs
5. when a canonical machine execution program exists, claim work before editing
   and keep one owner per work item

If a new file starts acting like a hidden second ledger, it should be folded back into the proper surfaces.
