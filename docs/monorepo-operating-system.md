# Air Jam Monorepo Operating System

Last updated: 2026-05-08  
Status: stable operating reference

## Purpose

This document defines the repo memory model for Air Jam so that:

1. orientation is fast
2. current snapshot is easy to recover
3. history stays durable without dominating daily navigation
4. plans stay bounded and current
5. humans and agents use the same repo operating system surfaces

This document is about repo memory and execution surfaces.

Engineering rules, validation discipline, and implementation behavior still live primarily in [../AGENTS.md](../AGENTS.md).

## Canonical Read Order

When starting work, prefer:

1. [../README.md](../README.md)
2. [docs-index.md](./docs-index.md)
3. [current-state.md](./current-state.md)
4. [working-agreements.md](./working-agreements.md)
5. [documentation-taxonomy.md](./documentation-taxonomy.md)
6. the relevant active plan
7. [work-ledger.md](./work-ledger.md) only if historical context is needed

## Canonical File Roles

### `README.md`

Owns:

1. repo identity
2. primary command surface
3. top-level app and package shape
4. outward links

### `docs/docs-index.md`

Owns:

1. navigation
2. read order
3. active plan and planned next pointers
4. core docs vs archive split

### `docs/current-state.md`

Owns:

1. the quick current snapshot
2. current focus
3. what is structurally done
4. what is still open
5. immediate next steps
6. the small set of plans that currently govern work

Rule:

1. update it only at phase closures, real reprioritizations, or repo operating system changes

### `docs/work-ledger.md`

Owns:

1. append-only historical memory
2. milestone closures
3. major validations
4. notable decisions worth preserving in time order

Rule:

1. it is history-first, not the main quick-read dashboard

### `docs/working-agreements.md`

Owns:

1. stable operating rules
2. doc roles
3. update rules
4. phase-close ritual

### `docs/plans/*.md`

Own:

1. bounded execution tracks
2. scope
3. sequencing
4. done criteria
5. stop rules

Rule:

1. plan status should be expressed through `current-state.md` and `docs-index.md`, not by letting stale plans linger as if they are active forever

### `docs/documentation-taxonomy.md`

Owns:

1. live docs category meaning
2. naming rules
3. directory role boundaries

Rule:

1. `docs/docs-index.md` should point to the taxonomy surface and directories instead of re-listing category README files

### `docs/suggestions.md`

Owns:

1. durable non-critical follow-ups
2. cleanup ideas
3. post-release improvements

Rule:

1. it is a backlog, not an active tracker

### `docs/archive/`

Owns:

1. completed plans
2. superseded execution snapshots
3. preserved historical context that should not compete with current work

Rule:

1. when a plan stops governing current work, archive it before moving focus elsewhere
2. archive filenames should prefer `YYYY-MM-DD-semantic-name.md` so explorer order stays chronological

## Working Model

The repo should operate on this loop:

1. architecture, strategy, and vision docs explain the intended system
2. `docs/current-state.md` explains what matters now
3. bounded plans explain how a large track closes
4. `docs/work-ledger.md` preserves historical execution memory
5. `docs/suggestions.md` captures non-critical follow-ups
6. completed or superseded plans move to `docs/archive/` before the repo focus shifts

## Active Plan Discipline

The active plan set should stay small.

Target:

1. one to three governing plans
2. one conditional fallback implementation plan at most

If the repo starts feeling like ten plans are active at once, the operating surface is drifting.

## Archive Rule

If a plan is:

1. completed
2. superseded
3. no longer shaping current work

it should move to `docs/archive/`.

Do not keep completed plans in the active plan surface just because they were important once.

## Phase-Close Requirement

A phase is only really closed when:

1. the implementation is complete enough for the intended slice
2. the intended validation has passed
3. the result is recorded in `docs/work-ledger.md`
4. `docs/current-state.md` reflects the new truth
5. the active plan and planned next surfaces are adjusted if needed
6. completed plans are archived or removed from the active surface
7. archive naming is normalized if the snapshot is being preserved

## Failure Mode To Avoid

The main repo operating system failure mode for Air Jam is no longer missing architecture.

It is memory drift:

1. history competing with the current snapshot
2. stale plans pretending to be active
3. navigation trying to be status reporting
4. chat context becoming the only reliable current-state surface

This document exists to keep that from happening again.
