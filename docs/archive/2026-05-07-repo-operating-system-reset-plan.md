# Air Jam Repo Operating System Reset Plan

Last updated: 2026-05-08  
Status: completed

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Docs Index](../docs-index.md)
3. [Monorepo Operating System](../monorepo-operating-system.md)
4. [Vision](../vision.md)
5. [Framework Paradigm](../framework-paradigm.md)
6. [V1 Release Launch Plan](./v1-release-launch-plan.md)
7. [Repo Operating System Upgrade Plan in `youtube-automation`](../../../youtube-automation/docs/plans/repository/repo-operating-system-upgrade-plan.md)
8. [Current State in `youtube-automation`](../../../youtube-automation/docs/current-state.md)
9. [Working Agreements in `youtube-automation`](../../../youtube-automation/docs/working-agreements.md)

## Why This Plan Exists

Air Jam's code and product direction are now stronger than the repo memory model around them.

The repo has reached the point where:

1. a lot of the hard infrastructure and platform work is already done
2. the current docs still make many tracks feel more active than they really are
3. there is no short canonical current-state surface for humans or agents
4. `docs/work-ledger.md` is carrying both historical memory and current truth
5. `docs/docs-index.md` is trying to act as navigation, current-state summary, release map, and archive catalog at the same time

The result is avoidable confusion:

1. the repo feels busier than it really is
2. orientation takes too long
3. current truth is easy to miss
4. historical execution detail competes with live execution guidance

This plan resets the Air Jam repo operating system so the repo once again has:

1. one fast orientation path
2. one clear current-state snapshot
3. one append-only historical ledger
4. one stable set of operating rules
5. a smaller and clearer active-plan surface

## Core Diagnosis

The current repo operating system has three main problems.

### 1. There Is No Quick Current-Truth Surface

Air Jam does not currently have the equivalent of a `docs/current-state.md`.

That means the only way to recover the present state is to scan:

1. [docs/work-ledger.md](../work-ledger.md)
2. [docs/docs-index.md](../docs-index.md)
3. many active plan files
4. chat memory or recent git history

That is too expensive for a repo of this size.

### 2. The Ledger Is Overloaded

[docs/work-ledger.md](../work-ledger.md) is currently doing too many jobs:

1. current status
2. release execution order
3. active-plan list
4. historical milestone log
5. implementation accomplishment rollup

Those are all useful, but they should not all live in the same high-churn file.

### 3. Navigation Is Too Heavy

[docs/docs-index.md](../docs-index.md) is too broad to function as a clean index.

It currently mixes:

1. read order
2. core docs
3. active plans
4. planned future plans
5. archived baselines
6. historical execution snapshots
7. release sequence summary

That makes it harder to skim and easier to misread.

## What We Are Taking From `youtube-automation`

This reset should intentionally borrow the parts of the tighter repo operating system that are actually helping there.

### 1. A Canonical `current-state.md`

Air Jam should gain a short current-state surface that answers:

1. what the repo is focused on now
2. what is already structurally done
3. what is still open
4. which plans are active now
5. which plans are planned next
6. what the immediate next steps are

### 2. A Stable `working-agreements.md`

Air Jam should separate stable operating rules from both the ledger and the monorepo doctrine.

That file should own:

1. read order
2. doc roles
3. active-plan lifecycle
4. update rules
5. phase-close ritual

### 3. A Smaller `docs-index.md`

The index should become:

1. navigation
2. read order
3. active now
4. planned next
5. core docs

It should stop trying to be a running report.

### 4. Explicit Memory Separation

The repo should cleanly separate:

1. front door
2. navigation
3. current truth
4. history
5. stable rules
6. active plans
7. archived history

That split is the biggest practical improvement we should import.

## Goals

1. Give Air Jam a one-minute orientation path.
2. Make current truth easy to find without scanning history.
3. Keep historical memory durable without letting it dominate daily navigation.
4. Make active-now versus planned-next versus historical status obvious.
5. Reduce the feeling that every plan is still live.
6. Keep the resulting repo operating system minimal and low-friction.

## Non-Goals

1. Do not rewrite product architecture as part of this reset.
2. Do not reopen framework/platform/release decisions that are already settled.
3. Do not create bureaucracy or a large new doc maze.
4. Do not turn `current-state.md` into a second ledger.
5. Do not move files around just to create the appearance of progress.
6. Do not let this reset delay launch-facing work longer than necessary.

## Target Operating System

### `README.md`

Role:

1. front door
2. repo identity
3. key commands
4. where to read next

### `docs/docs-index.md`

Role:

1. canonical navigation
2. read order
3. active now
4. planned next
5. link map for core docs and archive

### `docs/current-state.md`

Role:

1. short checkpoint snapshot
2. current focus
3. what is structurally done
4. what is still open
5. active-now plans
6. planned-next plans
7. immediate next steps

Rules:

1. derived from the ledger, active plans, and current repo reality
2. updated only at phase closures, major reprioritizations, or repo-OS changes
3. not used as a running log

### `docs/work-ledger.md`

Role:

1. append-only historical memory
2. milestone closures
3. validations
4. notable decisions
5. durable historical context

Rules:

1. history-first
2. no longer the main quick-read status surface
3. should preserve execution memory instead of competing with `current-state.md`

### `docs/working-agreements.md`

Role:

1. stable multi-human / multi-agent operating rules
2. read order
3. doc roles
4. update rules
5. phase-close ritual

### `docs/suggestions.md`

Role:

1. durable non-critical follow-ups
2. complexity-reduction backlog
3. future improvements that are not current execution

## Plan Surface Reset

The repo should move from:

1. many flat plan files with ambiguous live status

to:

1. a small explicit active-now set
2. a short planned-next set
3. the rest clearly treated as completed, archived, or non-current

This plan does not require finishing the whole taxonomy move immediately, but it should at least establish the status model and the rules for future reorganization.

## Proposed Execution Phases

### Phase 1. Define The New Operating Surfaces

Create and adopt:

1. `docs/current-state.md`
2. `docs/working-agreements.md`

Define their roles explicitly and update the read order everywhere that matters.

### Phase 2. Slim The Index

Rewrite [docs/docs-index.md](../docs-index.md) so it becomes:

1. short
2. navigational
3. obvious to skim

It should stop carrying broad historical and release-sequence summaries.

### Phase 3. Reframe The Ledger

Rewrite [docs/work-ledger.md](../work-ledger.md) so it becomes:

1. append-only history
2. historical milestone memory
3. closure/validation log

Important:

1. preserve valuable historical content
2. do not delete history casually
3. convert it from a live dashboard into durable repo memory

### Phase 4. Reduce Active Plan Ambiguity

Use `current-state.md` and `docs-index.md` to define:

1. active now
2. planned next
3. recently completed

This may also include a first pass of plan-area reorganization if it materially reduces confusion.

### Phase 5. Align Repo Entry Surfaces

Update:

1. [AGENTS.md](../../AGENTS.md)
2. [docs/monorepo-operating-system.md](../monorepo-operating-system.md)
3. [README.md](../../README.md) if needed

So the canonical read order becomes:

1. `README.md`
2. `docs/docs-index.md`
3. `docs/current-state.md`
4. the relevant active plan
5. `docs/work-ledger.md` only when history is needed

## Rules For The Reset

### 1. Be Aggressive About Clarity

Preserve truth, not clutter.

If a surface is doing two jobs badly, split it.

### 2. Be Conservative About History

Do not casually delete useful historical memory.

Prefer:

1. reframing
2. moving
3. archiving
4. summarizing

over silent loss of context.

### 3. Keep The New System Minimal

The goal is not to create more docs.

The goal is to make:

1. current truth
2. history
3. navigation
4. operating rules

each live in the right place.

### 4. Do Not Let This Become Infinite Repo Gardening

This reset should be bounded.

It should close once:

1. the new surfaces exist
2. the old surfaces are rewritten into the new roles
3. the active repo memory model is obvious

## Done Criteria

This plan is complete when:

1. Air Jam has a real [docs/current-state.md](../current-state.md).
2. Air Jam has a real [docs/working-agreements.md](../working-agreements.md).
3. [docs/docs-index.md](../docs-index.md) is shortened into a clean navigation surface.
4. [docs/work-ledger.md](../work-ledger.md) is clearly historical and append-only in role.
5. `AGENTS.md` and [docs/monorepo-operating-system.md](../monorepo-operating-system.md) point to the new orientation path.
6. the repo has an explicit active-now / planned-next / completed status model.
7. a fresh agent can recover current repo state in minutes without scanning historical logs or a large pile of plans.

## Immediate Recommendation

Do this reset before the next major launch-facing execution push.

Why:

1. the codebase is now strong enough that repo-memory confusion is the bigger drag
2. launch execution will go faster if the current truth is genuinely obvious
3. this is the right moment for a reset because the preview/deploy lane just closed successfully and the repo can now be re-baselined cleanly
