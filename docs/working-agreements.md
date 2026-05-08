# Working Agreements

Last updated: 2026-05-08  
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
6. [work-ledger.md](./work-ledger.md) only if historical context is needed

Agents should not need to scan the ledger before they can tell what matters now.

## Agent Operating Loop

Use this loop unless a task clearly requires something more specific:

1. orient from:
   1. `README.md`
   2. `docs/docs-index.md`
   3. `docs/current-state.md`
2. open only the relevant active plan
3. work inside the current ownership boundaries
4. validate the intended slice
5. update docs only where the rules below require it
6. explicitly close the phase if the slice is actually complete

If an agent jumps from chat context straight into edits without checking the current repo surfaces, it is operating incorrectly.

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

If a new file starts acting like a hidden second ledger, it should be folded back into the proper surfaces.
