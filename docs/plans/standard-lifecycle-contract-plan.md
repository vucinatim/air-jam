# Standard Lifecycle Contract Plan

Last updated: 2026-04-08  
Status: completed baseline

Related docs:

1. [Visual Review Harness Plan](./visual-review-harness-plan.md)
2. [Composition Shell Contract Plan](./composition-shell-contract-plan.md)
3. [Showcase Games Release Readiness Plan](./showcase-games-release-readiness-plan.md)
4. [Framework Paradigm](../framework-paradigm.md)
5. [Work Ledger](../work-ledger.md)
6. [Docs Index](../docs-index.md)

## Purpose

Define and adopt one clean standard lifecycle contract for Air Jam apps and games before the visual review harness and future agent tooling are built on top of unstable or ambiguous state semantics.

This is a prerelease clean-swap refactor.

The goal is:

1. one clear default lifecycle model
2. one clear split between transport/runtime state and game/app lifecycle state
3. stronger defaults for first-party games and `create-airjam`
4. explicit opt-out for unusual projects without polluting the default path

## Outcome

This prerelease clean-swap refactor is now implemented.

What landed:

1. shared SDK/runtime naming now cleanly separates:
   1. `runtimeState` for transport pause/play
   2. `matchPhase` for `lobby | countdown | playing | ended`
2. the shared SDK now exposes one canonical lifecycle contract module with phase guards and shell helpers
3. shared shell/runtime hooks now consume the split directly instead of blurring pause/play with lifecycle
4. all five first-party launch games now expose the standard top-level lifecycle cleanly in shell-facing code
5. `create-airjam` scaffold sources, generated docs, and public docs now teach the standard lifecycle as the default path
6. the visual harness plan is now formally unblocked and can assume this lifecycle baseline by default

Validation completed in this track:

1. `pnpm --filter @air-jam/sdk typecheck`
2. `pnpm --filter @air-jam/sdk test`
3. `pnpm --filter @air-jam/sdk build`
4. `pnpm --filter @air-jam/server typecheck`
5. `pnpm --filter @air-jam/server test`
6. `pnpm --filter @air-jam/server build`
7. `pnpm --filter platform typecheck`
8. `pnpm --filter platform test`
9. `pnpm --filter platform build`
10. `pnpm --filter pong typecheck && pnpm --filter pong test && pnpm --filter pong build`
11. `pnpm --filter air-capture typecheck && pnpm --filter air-capture test && pnpm --filter air-capture build`
12. `pnpm --filter code-review typecheck && pnpm --filter code-review test && pnpm --filter code-review build`
13. `pnpm --filter the-office typecheck && pnpm --filter the-office test && pnpm --filter the-office build`
14. `pnpm --filter last-band-standing typecheck && pnpm --filter last-band-standing test && pnpm --filter last-band-standing build`

## Why This Must Happen Before The Visual Harness

The visual harness needs predictable checkpoints.

If lifecycle semantics stay inconsistent, the harness becomes:

1. harder to build
2. harder to reuse
3. weaker for agents
4. more coupled to individual game quirks

The right order is:

1. standard lifecycle contract
2. shell contract and templates aligned to it
3. visual harness built on top of it

## Problem

Today the repo has two different concepts that are not cleanly separated everywhere:

1. runtime/transport state
2. game/app lifecycle state

The runtime layer already has a canonical pause/play model.

But the game/app layer is only partially standardized:

1. several games use `lobby | playing | ended`
2. `air-capture` adds `countdown`
3. some games still carry custom phase names and then map them ad hoc into shell behavior
4. the naming surface still encourages confusion between pause/play and lobby/playing/ended semantics

That ambiguity is survivable in a small repo.
It becomes a real cost once:

1. templates depend on it
2. harnesses depend on it
3. agents depend on it
4. Studio depends on it

## Decision Summary

1. keep low-level runtime state minimal and framework-owned
2. standardize the default Air Jam app/game lifecycle one layer above runtime core
3. enforce the standard contract for first-party games and default scaffolds
4. allow custom lifecycle only through an explicit adapter or mapping path
5. do a full purge refactor now rather than shipping legacy aliases and deprecations

## Target State Model

## 1. Runtime State

Framework-owned transport/runtime state:

1. `runtimeState = "playing" | "paused"`

Meaning:

1. whether the active runtime is currently paused or active
2. transport/runtime concern only
3. not a substitute for game/app lifecycle

## 2. Standard Match Phase

Default user-facing app/game lifecycle:

1. `matchPhase = "lobby" | "countdown" | "playing" | "ended"`

Meaning:

1. where the game or standard Air Jam app is in its primary lifecycle
2. the contract used by shells, templates, harnesses, and agent workflows

Notes:

1. `countdown` is optional for a given game, but part of the standard contract
2. games that do not need countdown simply move `lobby -> playing`

## 3. Game-Local Subphase

Optional richer game-owned detail:

1. `subphase`
2. or another clearly named local game-domain field

Examples:

1. `round-reveal`
2. `draft`
3. `shopping`
4. `task-review`

Rules:

1. richer game states belong here, not as a replacement for the standard top-level lifecycle
2. shells and harnesses should not need to understand these by default
3. if the game wants shell/harness behavior tied to them, it must provide explicit mapping

That explicit mapping is the preferred lifecycle-adapter path for the future visual harness.

## Enforced Default Vs Custom Opt-Out

## Standard Default Path

This should be the normal path for:

1. all first-party launch games
2. `create-airjam` default scaffolds
3. shell components and hooks
4. visual harness scenarios
5. docs and skills

The developer experience should strongly bias toward this path.

## Explicit Custom Path

Custom lifecycle models remain allowed, but only explicitly.

A project that deviates from the standard contract should:

1. keep `runtimeState` semantics intact
2. provide a clear adapter or mapping to standard lifecycle checkpoints
3. accept that default shells and harnesses may not work fully without that adapter

This preserves creative freedom without making the default system incoherent.

## Harness And Agent Implication

The standard lifecycle contract should directly power the future visual review harness and agent feedback loop.

The intended priority order is:

1. standard lifecycle presets work automatically for normal projects
2. unusual projects provide an explicit lifecycle adapter
3. only rare projects need fully custom visual-harness scenarios

## Clean Purge Rule

This track is a clean reset, not a compatibility migration.

Rules:

1. no deprecated aliases
2. no dual old/new naming layers
3. no long-lived “temporary” fallback mapping inside shared APIs
4. no ambiguous shell-facing use of transport `gameState` where lifecycle `matchPhase` should be used
5. if a boundary is unclear, refactor it now rather than layering around it

## What Gets Standardized

The standard contract should define:

1. canonical naming
2. canonical top-level lifecycle values
3. canonical shell expectations for each top-level phase
4. canonical harness checkpoint assumptions
5. canonical template authoring guidance

It should not define:

1. detailed per-game mechanics
2. rich local state machines
3. one mandatory visual style
4. one mandatory UI component tree

What becomes easier by standardizing:

1. shell behavior
2. template behavior
3. harness checkpoint behavior
4. agent reasoning about UI states

## Lifecycle Semantics

## `lobby`

Meaning:

1. pre-match, pre-run, pre-round-start
2. joining, identity, teams, readiness, role selection, setup

Expected shell/harness assumptions:

1. host join affordances visible
2. start action potentially visible
3. controller lobby UI visible

## `countdown`

Meaning:

1. match has started
2. a transitional active-start phase exists before free gameplay

Expected shell/harness assumptions:

1. active match shell
2. gameplay-adjacent or gameplay-prep view
3. usually no return to setup-only lobby affordances except explicit cancel paths if the game wants them

## `playing`

Meaning:

1. active gameplay or active app-run phase

Expected shell/harness assumptions:

1. controller gameplay controls visible
2. runtime may be `playing` or `paused`

## `ended`

Meaning:

1. match or app run is complete
2. result summary is visible before reset

Expected shell/harness assumptions:

1. score/result screen exists
2. replay/reset/back-to-lobby affordance exists

## Architecture Boundaries

## Framework Core

Owns:

1. `runtimeState`
2. host authority and controller intent transport
3. generic shell/runtime bridging primitives

Does not own:

1. one mandatory top-level match lifecycle enum for every project at the absolute lowest layer

## Standard Lifecycle Contract Layer

Owns:

1. `matchPhase`
2. default shell semantics
3. default harness semantics
4. default template semantics

This can live in shared SDK/UI or an adjacent shared contract module, but it should stay clearly above transport/runtime core.

## Game Layer

Owns:

1. local subphases
2. game-specific progression detail
3. mapping from local rich states to standard top-level lifecycle, when needed

## Execution Workstreams

### Workstream A. Contract Lock

1. lock final names:
   1. `runtimeState`
   2. `matchPhase`
   3. optional local `subphase`
2. document canonical meanings and allowed values
3. document standard shell expectations by phase

Done when:

1. the naming is unambiguous
2. docs no longer blur runtime pause/play with game lifecycle

### Workstream B. Shared Contract Extraction

1. add one canonical shared lifecycle contract module
2. export helpers and phase guards
3. make shell code consume the shared contract rather than ad hoc strings

Done when:

1. shell-facing lifecycle logic no longer hand-rolls the same semantics per game

### Workstream C. Shared SDK/UI Alignment

1. update shared shell hooks and components to accept the standard lifecycle model cleanly
2. remove ambiguous naming where lifecycle and runtime concerns are mixed
3. keep pause/play logic driven by `runtimeState`
4. keep lobby/countdown/playing/ended logic driven by `matchPhase`

Done when:

1. shared shell APIs reflect the split cleanly
2. no shell-facing code pretends paused is the same concept as lobby

### Workstream D. First-Party Game Migration

Migrate:

1. `pong`
2. `air-capture`
3. `code-review`
4. `last-band-standing`
5. `the-office`

Rules:

1. every first-party game must expose standard `matchPhase`
2. richer local states become subphases or internal detail
3. no game keeps alternate top-level lifecycle naming for concepts that are really standard lifecycle checkpoints

Done when:

1. all five first-party games conform cleanly
2. no legacy lifecycle naming remains in first-party shell-facing code

### Workstream E. Template And Docs Migration

1. update `create-airjam` defaults to teach and use the standard lifecycle
2. update template docs and skills
3. update global docs and examples
4. document the custom-lifecycle adapter path as advanced usage

Done when:

1. default authoring guidance is crystal clear
2. custom lifecycle is possible but clearly exceptional

### Workstream F. Harness Prerequisite Alignment

1. update the visual harness plan so it formally depends on this contract
2. define default harness checkpoints in terms of standard `matchPhase`
3. define the lifecycle-adapter path for custom projects
4. define when full custom scenarios are actually necessary

Done when:

1. the visual harness can assume a stable lifecycle baseline by default

## Migration Rules

1. prefer one full purge pass over prolonged mixed naming
2. do not support both old and new lifecycle names in shared APIs
3. refactor repo-owned games and scaffold sources in the same track
4. update tests alongside behavior contracts
5. do not fake standardization by mapping everything at the last UI layer only

## Documentation And Agent Contract

This lifecycle model should become the normal reasoning model for Air Jam.

Docs and agent guidance should teach:

1. `runtimeState` answers pause/play
2. `matchPhase` answers lifecycle
3. `subphase` answers richer game detail

Agents should be able to assume this by default for:

1. shells
2. harnesses
3. scaffolds
4. first-party game review

## Risks

1. over-enforcing the lowest layer and making unusual projects awkward
2. under-enforcing the default contract and keeping ambiguity alive
3. hiding real custom-state complexity behind fake “standard” naming
4. migrating only docs or only games and leaving the repo inconsistent

## Guardrails

1. keep enforcement at the default-contract layer, not the absolute lowest runtime core
2. keep explicit opt-out through adapters for unusual projects
3. keep first-party games and scaffolds held to a higher standard than one-off experiments
4. do the refactor before the visual harness is implemented broadly

## Acceptance Criteria

This plan is complete when:

1. the repo has one documented standard lifecycle contract
2. `runtimeState` and `matchPhase` are cleanly separated in shared APIs
3. all five first-party launch games use the standard top-level lifecycle
4. templates and docs teach the standard lifecycle as the normal path
5. custom lifecycle is still possible only through explicit mapping/adapters
6. the visual harness plan can safely assume this lifecycle by default

Current status:

1. complete

## Recommended Order

1. lock and document the contract
2. refactor shared shell/lifecycle APIs
3. migrate first-party games
4. migrate scaffolds and docs
5. then implement the visual review harness on top
