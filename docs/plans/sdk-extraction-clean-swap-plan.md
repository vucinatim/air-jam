# SDK Extraction Clean-Swap Plan

Last updated: 2026-04-07  
Status: active

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [Suggestions](../suggestions.md)
4. [SDK Surface Plan (Archived)](../archive/sdk-surface-plan.md)
5. [SDK Composability Plan (Archived)](../archive/sdk-composability-plan-2026-03-31.md)
6. [Showcase Games Release Readiness Plan](./showcase-games-release-readiness-plan.md)

## Purpose

Define one explicit prerelease refactor track for moving proven cross-game framework behavior into `@air-jam/sdk` with a full clean swap.

This plan is intentionally narrow.

It is for:

1. repeated runtime and controller/host glue that clearly belongs to the framework
2. small optional UI composites that solve the same Air Jam-specific surface problem across games
3. replacing repo game usage as part of the extraction, not leaving old and new paths side by side

It is not for:

1. turning game-specific lobby, team, or round logic into SDK abstractions
2. adding configurable pseudo-framework layers for gameplay structure
3. keeping prerelease compatibility wrappers, deprecated aliases, or dual APIs around "just in case"

## Core Decision

Air Jam is still prerelease.

That means this track should optimize for a cleaner end state instead of backward-compatibility scaffolding.

The contract for this plan is:

1. extract only what is clearly framework-owned
2. migrate all repo-owned games and scaffold sources in the same track
3. remove superseded usage patterns instead of leaving legacy wrappers behind
4. keep the SDK smaller and clearer after the refactor, not broader and more configurable

## Why This Refactor Is Worth Doing

Current repo-owned games repeat the same framework glue in several places:

1. controller input publishing loops
2. host join URL fallback resolution
3. platform settings mounting
4. join and connection presentation surfaces built from the same SDK atoms

That repetition hurts both human and AI-driven development because it creates too many nearly-canonical ways to wire the same runtime behavior.

The goal is not "more shared code".
The goal is fewer ambiguous framework decisions in game code.

## Extraction Rules

A behavior belongs in the SDK only if all of the following are true:

1. it represents a stable Air Jam runtime or host/controller surface concept
2. at least two repo-owned games already solve the same problem in materially the same way
3. moving it into the SDK reduces game-code decisions instead of adding more options
4. the abstraction can be documented as the canonical path without caveats

If any of those are false, keep it in game code or extract it later into a first-party game-kit instead of `@air-jam/sdk`.

## Target Scope

## 1. Runtime And Logic Extractions

### A. Controller Input Publishing Primitive

Promote the repeated controller-side input loop pattern into one canonical SDK helper.

Current repetition appears across:

1. `games/pong`
2. `games/code-review`
3. `games/the-office`
4. `games/air-capture`

The extracted primitive should cover:

1. stable tick-driven publish wiring
2. local mutable input draft ownership
3. blur / visibility reset hooks
4. pulse-safe one-shot fields without each game hand-resetting refs ad hoc

The primitive should not own:

1. gesture semantics
2. game-specific control layout
3. gyroscope interpretation
4. game-specific local controller stores

Result:

1. game code defines the input model
2. SDK owns the publish contract

### B. Host Join URL Contract

`useAirJamHost()` should provide a dependable join surface contract.

Current repetition:

1. games rebuild a fallback controller URL from `roomId`
2. QR surfaces have to guess whether `joinUrl` is trustworthy yet

Target:

1. one host-owned join URL contract from the SDK
2. no game manually rebuilding controller join URLs from `window.location.origin`
3. one obvious source for room code, join URL, and join availability state

### C. Runtime-Owned Platform Settings Mounting

`PlatformSettingsRuntime` is repeated often enough that it should stop being a per-game composition concern.

Target:

1. host and controller runtime boundaries mount platform settings automatically where appropriate
2. games stop manually wrapping host/controller roots only to regain default settings behavior
3. inherited-vs-owner semantics remain explicit inside the SDK implementation, not in app bootstrap code

This does not mean all audio wiring becomes automatic.
It means the platform settings layer stops leaking into every app tree.

## 2. Optional UI Extractions

The SDK already has useful low-level atoms:

1. `ForcedOrientationShell`
2. `RoomQrCode`
3. `PlayerAvatar`
4. `HostMuteButton`

This plan should not add large game-shaped UI.
It should add only small optional composites where the same Air Jam-specific surface appears repeatedly.

### A. Join Surface Composite

Add one optional composite for host join presentation.

It should cover:

1. room code display
2. QR display
3. join URL copy/open affordances
4. clear loading / unavailable states

It should remain:

1. optional
2. themeable via props / class names
3. small enough that games can embed it inside their own lobby chrome

It should not become:

1. a full lobby component
2. a game start flow manager
3. a branded SDK screen

### B. Connection Notice Primitive

Add one optional primitive for simple connection-state presentation on host or controller surfaces.

It should solve:

1. reconnecting copy
2. disconnected copy
3. disabled-controls status presentation

It should not own:

1. gameplay state
2. phase transitions
3. game-specific warnings

### C. UI Surface Audit

As part of the clean swap, audit the current SDK UI exports.

Rule:

1. if a current SDK UI export is not justified by real canonical usage after migration, remove it instead of preserving low-value surface area

That includes checking whether currently exported components such as player-strip style helpers still deserve to stay public.

## Explicit Non-Scope

These should not move into the SDK in this track:

1. team assignment logic
2. lobby readiness policies
3. bot slot policies
4. score strip and player strip components
5. host/player phase orchestration
6. character pickers
7. quiz round engines
8. gyroscope gameplay adapters
9. office-task or pong-match domain rules
10. any generic "game phase framework"

If those patterns later prove stable across multiple first-party games, extract them into a separate first-party game-kit rather than core SDK.

## Migration Contract

This plan is a full clean swap.

That means every extraction must follow all of these rules:

1. update SDK implementation
2. update SDK docs
3. migrate all repo-owned game usage that the new API replaces
4. migrate `create-airjam` scaffold sources to the new canonical path
5. remove the superseded pattern in the same track

Do not leave behind:

1. deprecated exports
2. compatibility aliases
3. "legacy" wrapper components
4. duplicate codepaths in repo games
5. scaffold templates teaching the old pattern

## Execution Workstreams

### Workstream A. Surface Inventory And Final API Lock

1. inventory all repeated framework-owned host/controller glue in repo games
2. confirm the minimal API additions needed
3. reject anything that is game-specific or too configurable
4. define final names before implementation starts

Done when:

1. the target SDK additions are explicit
2. the "do not extract" list is explicit

### Workstream B. Runtime Logic Refactor

1. add the controller input publishing primitive
2. fix host join URL ownership
3. move platform settings mounting behind runtime ownership where appropriate
4. remove now-obsolete per-game glue

Done when:

1. repo games no longer hand-roll these framework concerns
2. the SDK owns the canonical path

### Workstream C. Optional UI Composite Refactor

1. add the join surface composite
2. add the connection notice primitive
3. adopt them only where they materially improve clarity
4. avoid forced visual homogenization across games

Done when:

1. repeated Air Jam-specific join/connection UI no longer has to be rebuilt from atoms every time
2. games still retain their own visual identity

### Workstream D. Repo-Wide Clean Swap

1. migrate `games/pong`
2. migrate `games/air-capture`
3. migrate `games/code-review`
4. migrate `games/last-band-standing`
5. migrate `games/the-office`
6. migrate `packages/create-airjam/scaffold-sources/*`
7. remove superseded SDK exports or repo-local copies where justified

Done when:

1. all repo-owned games use the new canonical path
2. no repo-owned game still depends on the old framework glue pattern

### Workstream E. Docs And Validation

1. update SDK docs and examples
2. update scaffold docs if they mention replaced patterns
3. verify no generated docs or skills still teach the old path
4. run targeted repo validation

Done when:

1. repo guidance matches implementation
2. no canonical docs teach stale usage

## Phase Plan

### Phase 0. Inventory And Naming Lock

1. confirm final extraction list
2. confirm final API names
3. confirm which current SDK UI exports remain public

### Phase 1. Runtime Contract Extraction

1. land controller input primitive
2. land host join URL contract cleanup
3. land runtime-owned platform settings mounting

### Phase 2. UI Composite Extraction

1. land join surface composite
2. land connection notice primitive
3. audit current UI surface for removals

### Phase 3. Repo Game Migration

1. migrate reference pair first: `pong` and `air-capture`
2. migrate showcase trio second: `code-review`, `last-band-standing`, `the-office`
3. remove replaced patterns as each slice lands

### Phase 4. Scaffold And Docs Migration

1. update `create-airjam` scaffold sources
2. update SDK README and examples
3. update any generated or repo-local docs that teach the old path

### Phase 5. Final Surface Cleanup

1. remove superseded exports
2. remove dead repo-local helpers made obsolete by the extraction
3. verify the public SDK reads as one clean canonical product surface

## Validation Contract

Every phase should keep validation proportional but real.

Minimum final validation for the full clean swap:

1. `pnpm --filter sdk build`
2. `pnpm --filter sdk test`
3. `pnpm --filter create-airjam build`
4. `pnpm --filter pong typecheck && pnpm --filter pong test && pnpm --filter pong build`
5. `pnpm --filter air-capture typecheck && pnpm --filter air-capture test && pnpm --filter air-capture build`
6. `pnpm --filter code-review typecheck && pnpm --filter code-review test && pnpm --filter code-review build`
7. `pnpm --filter last-band-standing typecheck && pnpm --filter last-band-standing test && pnpm --filter last-band-standing build`
8. `pnpm --filter the-office typecheck && pnpm --filter the-office test && pnpm --filter the-office build`
9. rerun relevant Arcade smoke if the refactor touches boot/runtime paths

## Exit Criteria

This plan is complete when:

1. the selected framework-owned behaviors live in `@air-jam/sdk`
2. the join and connection optional composites exist where justified
3. all repo-owned games and scaffold sources use the new canonical path
4. no deprecated or legacy compatibility layer remains
5. the SDK surface is cleaner and smaller in decision count than before the refactor

## Current Recommendation

This refactor is worth doing only if it stays strict.

The right version is:

1. extract a few obvious framework contracts
2. migrate repo usage fully
3. remove superseded paths

The wrong version is:

1. pull game logic into the SDK
2. add many configurable abstractions
3. keep both old and new APIs alive through release

This plan should follow the first path only.
