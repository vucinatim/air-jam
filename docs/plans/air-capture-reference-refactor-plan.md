# Air Capture Reference Refactor Plan

Last updated: 2026-03-29  
Status: active

Related docs:

1. [Release-Facing Polish Plan](./release-polish-plan.md)
2. [V1 Release Launch Plan](./v1-release-launch-plan.md)
3. [Framework Paradigm](../framework-paradigm.md)
4. [Monorepo Operating System](../monorepo-operating-system.md)
5. [Pong Template README](../../packages/create-airjam/templates/pong/README.md)
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

## Anti-Goals

Do not:

1. rewrite working gameplay for style points
2. try to make `air-capture` identical to `pong`
3. move game-specific rules into the SDK without strong reuse proof
4. chase visual polish while structure is still mixed
