# Air Capture Reference Refactor Plan

Last updated: 2026-03-30  
Status: active

Related docs:

1. [Release-Facing Polish Plan](./release-polish-plan.md)
2. [V1 Release Launch Plan](./v1-release-launch-plan.md)
3. [Framework Paradigm](../framework-paradigm.md)
4. [Monorepo Operating System](../monorepo-operating-system.md)
5. [Pong Template README](../../games/pong/README.md)
6. [Docs Index](../docs-index.md)

## Purpose

This plan turns the `air-capture` cleanup into one deliberate architecture pass instead of more isolated fixes.

The goal is:

1. make `air-capture` structurally align with the modern Air Jam template direction
2. preserve the parts that are already healthy
3. add just enough tests and seams that it becomes a real public reference app

It is not to rewrite the game for aesthetic purity.

## Why This Exists

`air-capture` is now the last major first-party game that still teaches the older mixed structure:

1. route entry files still live under `src/routes`
2. host and controller boundaries are not top-level
3. game state is spread across many flat sibling stores
4. `components/` is a very broad bucket mixing scene composition, gameplay entities, debug tools, and HUD surfaces
5. there is currently no real `tests/` surface

That makes the game feel structurally behind `pong`, even though it is still one of the strongest public proofs of Air Jam.

## Current Structure Problems

### 1. Entry Boundaries Are Too Implicit

Current:

1. `src/routes/host-view.tsx`
2. `src/routes/controller-view.tsx`

Problem:

1. these are the runtime owner files, but the current folder shape does not teach that clearly
2. they have grown into large mixed modules instead of acting as clean top-level surfaces

### 2. Game State Is Too Flat

Current examples:

1. `src/game/game-store.ts`
2. `src/game/match-store.ts`
3. `src/game/capture-the-flag-store.ts`
4. `src/game/health-store.ts`
5. `src/game/player-stats-store.ts`
6. `src/game/collectibles-store.ts`
7. `src/game/lasers-store.ts`
8. `src/game/rockets-store.ts`
9. `src/game/debug-store.ts`

Problem:

1. the stores are individually understandable, but the folder shape does not teach ownership well
2. some state is domain state, some is hot runtime state, some is debug state, and some is scene object state
3. `game-store.ts` coordinates sibling stores directly, which is a useful seam but currently feels too central and generic

### 3. Scene Components Are Over-Bucketed

Current:

1. a large `src/game/components/` bucket

Problem:

1. gameplay entities, environment pieces, HUD overlays, debug UI, and editor tools all sit together
2. that makes discovery and testing harder

### 4. The Game Is Missing The New Teaching Surface

Compared to `pong`, `air-capture` is missing the clear starter/reference shape for:

1. `host/`
2. `controller/`
3. `game/domain/`
4. `game/stores/`
5. `game/engine/`
6. `game/prefabs/`
7. `game/ui/`
8. `game/debug/`
9. `tests/`

### 5. Team And Slot Presentation Is Weaker Than Pong

Problem:

1. `air-capture` already has team assignment and readiness logic, but it does not present or structure it as cleanly as the newer Pong slot model
2. the current team/player surface is functional, but it is not yet a strong reusable reference for mixed players, bots, and occupancy
3. the launch set would benefit from one clearer canonical team-slot model across both reference games

## Refactor Principles

### 1. Preserve Healthy Game Logic

Do not rewrite healthy combat, bot, or scene logic just to move files around.

### 2. Make Ownership Obvious

After this refactor, a contributor should be able to answer quickly:

1. where host-only code lives
2. where controller-only code lives
3. where domain rules live
4. where replicated state lives
5. where runtime scene orchestration lives
6. where debug-only tooling lives

### 3. Move In Layers

Do not try to redesign every subsystem at once.

Move in this order:

1. entry boundaries
2. state boundaries
3. scene/UI boundaries
4. test boundaries

### 4. Avoid Fake Reuse

Do not push game-specific rules into the SDK just to make `air-capture` shorter.

## Target Structure

The intended shape should move toward:

```text
src/
  app.tsx
  airjam.config.ts
  host/
    index.tsx
    components/
    hooks/
  controller/
    index.tsx
    components/
    hooks/
  game/
    input.ts
    domain/
    adapters/
    stores/
    engine/
    prefabs/
    ui/
    debug/
    audio/
    shared/
  ui/
    icons/
  main.tsx
tests/
  game/
```

This does not mean every current file needs a one-to-one new home immediately.
It means the public architecture should converge on this model.

## Pong Parity Target

The goal is not to make `air-capture` identical to `pong`.

The goal is to make it comparably clean and comparably teachable.

That means `air-capture` should end this refactor with the same kind of visible architectural guarantees that `pong` already provides:

1. top-level `host/` and `controller/` entry surfaces
2. explicit `game/domain/`, `game/stores/`, `game/engine/`, `game/prefabs/`, `game/ui/`, and `game/debug/` layers
3. runtime owner hooks used only in the top-level host/controller entry files
4. shared game-facing UI isolated from host/controller shells
5. a clearer team-slot/occupancy model comparable to Pong where that improves lobby readability and mixed human/bot staging
6. tests focused on pure rules and state transitions rather than browser-heavy scene behavior
7. a README structure section that teaches the final file layout clearly

Comparable to `pong` does not mean:

1. every module count must match
2. every subsystem needs the same depth
3. the 3D runtime must be flattened into a toy starter shape

`air-capture` is naturally larger and more simulation-heavy.
It should stay richer than `pong`, but it should no longer be structurally older than `pong`.

## Proposed Mapping

### 1. Entry Surface Move

Move:

1. `src/routes/host-view.tsx` -> `src/host/index.tsx`
2. `src/routes/controller-view.tsx` -> `src/controller/index.tsx`

Then:

1. move host-only child surfaces into `src/host/components/`
2. move controller-only child surfaces into `src/controller/components/`
3. keep owner hooks only in those top-level entry files

### 2. Domain Extraction

Move or create:

1. team definitions from `capture-the-flag-store.ts` into `game/domain/team.ts`
2. lobby/match readiness from `match-readiness.ts` into `game/domain/match-readiness.ts`
3. flag/capture rules into a domain-oriented module if they can be separated cleanly from Zustand wiring
4. ability metadata shape into a domain/shared layer if it is still mixed with runtime implementation details

Goal:

1. pure game rules should be readable without stepping through UI or scene code

### 3. Store Reorganization

Reshape the flat store set into:

1. `game/stores/match/`
2. `game/stores/players/`
3. `game/stores/projectiles/`
4. `game/stores/world/`
5. `game/stores/debug/`

Minimum expected outcome:

1. `match-store.ts`, `capture-the-flag-store.ts`, and `game-store.ts` should no longer read like three top-level peers with unclear ownership
2. the coordinating store should become more explicit about what it owns and what it derives

### 4. Engine / Scene Separation

Split the current broad scene layer into clearer buckets:

1. `game/engine/`
   1. runtime orchestration
   2. hot scene logic
   3. per-frame systems
2. `game/prefabs/`
   1. arena pieces
   2. jump pads
   3. bases
   4. reusable scene composition
3. `game/ui/`
   1. HUD
   2. score overlays
   3. lobby-facing shared game UI
4. `game/debug/`
   1. debug overlay
   2. object editor
   3. physics recorder/report tools

### 5. Audio Surface

The current `sounds.ts` and background-music hook should move toward:

1. `game/audio/sounds.ts`
2. `game/audio/use-background-music.ts`

This keeps audio out of generic `game/` root clutter.

## Current File Mapping

This is the intended first-pass mapping for the highest-value current files.

### Entry And Surface Files

1. `src/routes/host-view.tsx` -> `src/host/index.tsx`
2. `src/routes/controller-view.tsx` -> `src/controller/index.tsx`
3. host-only overlays and host UI extracted from `host-view.tsx` -> `src/host/components/`
4. controller-only lobby/gameplay UI extracted from `controller-view.tsx` -> `src/controller/components/`

### Domain And Shared Rules

1. `src/game/match-readiness.ts` -> `src/game/domain/match-readiness.ts`
2. `TEAM_CONFIG` and `TeamId` from `src/game/capture-the-flag-store.ts` -> `src/game/domain/team.ts`
3. capture/flag rule helpers extracted from `src/game/capture-the-flag-store.ts` -> `src/game/domain/flag-rules.ts` if the seam is clean
4. ability metadata shape from `src/game/abilities-store.ts` -> `src/game/domain/abilities.ts` or `src/game/shared/abilities.ts` if it is not runtime-specific
5. if the current player/team occupancy rules are still too ad hoc, create an explicit slot-oriented domain helper comparable to the Pong team-slot model

### Store Layer

1. `src/game/match-store.ts` -> `src/game/stores/match/`
2. `src/game/game-store.ts` -> `src/game/stores/players/` or a more explicit coordinating store module
3. `src/game/capture-the-flag-store.ts` -> `src/game/stores/match/` plus domain extraction
4. `src/game/health-store.ts` and `src/game/player-stats-store.ts` -> `src/game/stores/players/`
5. `src/game/collectibles-store.ts`, `src/game/lasers-store.ts`, and `src/game/rockets-store.ts` -> `src/game/stores/world/` or `src/game/stores/projectiles/`
6. `src/game/debug-store.ts` and `src/game/physics-store.ts` -> `src/game/stores/debug/`

### Engine, Prefabs, UI, And Debug

1. `src/game/components/game-scene.tsx` -> `src/game/engine/scene.tsx` or `src/game/engine/game-scene.tsx`
2. camera/render hooks from `src/game/hooks/` -> `src/game/engine/` when they are runtime orchestration concerns
3. arena/environment/world pieces from `src/game/components/` -> `src/game/prefabs/`
4. HUD and score overlays -> `src/game/ui/`
5. debug overlays, recorder/report surfaces, and editor panels -> `src/game/debug/`
6. `src/game/sounds.ts` and `src/game/hooks/use-background-music.ts` -> `src/game/audio/`

### Gameplay Debug Surfaces That Should Stay

The practical host cheat/debug panel is still valuable and should remain as part of the public internal-development story.

Keep and refactor as needed:

1. bot controls
2. item/health/debug toggles
3. host-only gameplay cheat surfaces that help validate the game quickly

The goal is to move these into a clearer `game/debug/` and `host/components/` structure, not to remove them.

### Temporary Tooling We Intentionally Do Not Preserve

The current ad hoc model/viewer/editor surface should not survive this refactor as a first-class public pattern.

This includes:

1. `src/game/components/game-object-editor.tsx`
2. the editor panel and object-type switcher currently embedded in `src/routes/host-view.tsx`
3. `src/components/physics-recorder-ui.tsx`
4. `src/game/components/physics-report-dialog.tsx`
5. `src/game/components/physics-recorder.tsx`

These may remain temporarily during transition, but the refactor should treat them as replaceable debug tooling.

Rule:

1. do not restructure the new `prefabs/` layer around the needs of the current editor panel
2. do not preserve the current model-viewer/editor UX as if it were the canonical prefab workflow
3. assume a future standardized prefab/editor surface will replace it

This does not apply to the practical gameplay cheat/debug panel.
That panel should survive, but in a cleaner home.

## Phase Exit Criteria

Each phase should have a stronger exit bar than “the code moved.”

### Phase 1 Exit Criteria

1. `src/routes/host-view.tsx` and `src/routes/controller-view.tsx` no longer exist as runtime owner files
2. `src/host/index.tsx` and `src/controller/index.tsx` are the only runtime owner entry files
3. behavior is unchanged
4. `pnpm --filter air-capture typecheck` and `pnpm --filter air-capture build` still pass

### Phase 2 Exit Criteria

1. team/readiness rules are readable without opening UI or scene modules
2. `match-store`, `capture-the-flag-store`, and `game-store` have explicit and non-overlapping roles
3. the top-level `src/game/*.ts` store sprawl is materially reduced
4. no new generic catch-all store is introduced just to preserve old ambiguity
5. the player/team occupancy model is clearer and can support a cleaner slot-oriented lobby surface if needed

### Phase 3 Exit Criteria

1. the giant `src/game/components/` bucket is materially reduced or removed as the primary architecture surface
2. debug/editor tooling is isolated under `game/debug/`
3. world composition is visible under `game/prefabs/`
4. HUD/shared game-facing presentation is visible under `game/ui/`
5. the current model-viewer/editor surface is no longer shaping the public architecture
6. the practical host cheat/debug panel still exists and is easier to locate and maintain

### Phase 4 Exit Criteria

1. `tests/` exists
2. at least the most important domain/store seams are covered
3. the test surface teaches the same “pure rules first” philosophy as `pong`
4. `pnpm --filter air-capture test` exists and passes

### Phase 5 Exit Criteria

1. `air-capture` runs locally through Arcade after the refactor
2. host/controller/lobby/match/return flows still work
3. the game is credible enough to stand beside `pong` in the public launch set
4. the README reflects the final architecture

## Testing Plan

`air-capture` currently has no `tests/` directory.

That is acceptable historically, but not ideal if this app is meant to be a public reference game.

The goal is not to create exhaustive scene tests.
The goal is to add the minimal high-value safety net.

### Required New Tests

1. domain tests
   1. match readiness
   2. team/count rules
2. store tests
   1. match transitions
   2. core player/team assignment behaviors
3. focused engine or helper tests where a pure seam exists after the refactor

### Not Required

1. broad Three.js rendering snapshot tests
2. expensive browser-driven gameplay tests for every behavior
3. trying to test every particle, camera, or shader path

## Execution Phases

### Phase 1. Entry And Folder Boundary Reset

Goal:

1. move host/controller to top-level
2. create the modern directory scaffold
3. keep behavior unchanged

Done when:

1. host entry is `src/host/index.tsx`
2. controller entry is `src/controller/index.tsx`
3. broad route-era naming is gone

### Phase 2. Domain And Store Clarification

Goal:

1. extract pure rules from store files
2. regroup the flat store surface into clearer ownership buckets

Done when:

1. `match-store`, `capture-the-flag-store`, and `game-store` have clearer roles
2. pure rules are no longer buried inside Zustand setup by default

### Phase 3. Scene, Prefab, UI, And Debug Separation

Goal:

1. break up the giant `components/` bucket into meaningful layers

Done when:

1. the scene layer is easier to navigate
2. debug tools are isolated
3. reusable world composition is visible as prefabs

### Phase 4. Test Baseline

Goal:

1. add the minimum meaningful tests for public reference quality

Done when:

1. `air-capture` has a real `tests/` directory
2. the most important pure behaviors have regression coverage

### Phase 5. Local Arcade Validation

Goal:

1. prove the refactored game still works in the real host/controller shell path

Done when:

1. `air-capture` runs locally through Arcade
2. core lobby, join, match start, play, and return flows still work

## Validation Gates

At minimum, each major phase should preserve:

1. `pnpm --filter air-capture typecheck`
2. `pnpm --filter air-capture build`

At the end of the full pass:

1. `pnpm --filter air-capture test`
2. local Arcade manual validation

## Success Criteria

This refactor is complete when:

1. `air-capture` teaches the same architecture story as `pong`
2. contributors can navigate host/controller/game boundaries quickly
3. the game has a real minimal test surface
4. the app still feels like the same game, not a broken rewrite
5. it is good enough to include in the five-game public launch set

## Progress So Far

Completed in this pass:

1. host and controller runtime owners moved to top-level `src/host/` and `src/controller/`
2. team, readiness, and CTF rule seams were extracted into `game/domain/` and pure store-state reducers
3. flat store sprawl was regrouped under `game/stores/`, with the remaining large match store logic pushed behind explicit reducers
4. runtime scene code was separated into `game/engine/`, `game/prefabs/`, `game/ui/`, `game/debug/`, and `game/audio/`
5. host and controller entry files were reduced into clearer shell owners with extracted surface components
6. the remaining render leaf layer was narrowed into `game/components/entities/`, `models/`, and `effects/`
7. team-slot and arena prefab contracts were standardized into explicit domain and prefab seams
8. hot ship stepping, weapon geometry, lifecycle timing, ship runtime state/tracking, ship and projectile frame orchestration hooks, engine-audio transitions, and shared projectile impact/runtime logic now have explicit `game/engine/` seams instead of living only inside entity components
9. a real `tests/` surface now exists for domain, prefab, store, and focused engine coverage
10. the current `air-capture` baseline now includes 69 passing tests across those pure seams
11. `pnpm --filter air-capture typecheck`, `test`, and `build` pass
12. local Arcade manual validation confirmed host, controller, lobby, match, and return flows still work

## Remaining To Fully Close

This plan should stay open until the remaining architecture truth is actually done.

Remaining:

1. keep shrinking component-owned simulation where a clean engine or adapter seam exists, especially around entity-level scene/world queries and other per-frame coordination
2. keep adding focused pure tests whenever a new engine/domain seam is introduced so the runtime components do not become the only safety net again
3. rerun local Arcade validation after the final engine-boundary pass and only then mark the plan complete

## Anti-Goals

Do not:

1. rewrite working gameplay for style points
2. try to make `air-capture` identical to `pong`
3. move game-specific rules into the SDK without strong reuse proof
4. chase visual polish while structure is still mixed
