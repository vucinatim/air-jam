<!-- Generated from content/docs/for-agents/project-structure/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://air-jam.app/docs/for-agents/project-structure -->

# Project Structure

Air Jam games should not grow as one large React surface.

The clean default is a boundary-first structure where host logic, controller logic, pure game rules, and framework integration do not collapse into the same modules.

## Framework Recommendation

Move toward a structure like this:

```text
src/
  host/
  controller/
  game/
    domain/
    engine/
    systems/
    adapters/
    ui/
    debug/
  shared/
```

The exact folder names can vary slightly, but the boundaries should stay clear.

This is a framework-level recommendation about ownership boundaries, not a requirement that every Air Jam game use the exact same filenames.

### `src/host/`

Owns host-only composition and shell behavior.

Examples:

1. host screens
2. room and join presentation
3. host-facing overlays
4. host runtime composition

### `src/controller/`

Owns controller-only composition and touch interactions.

Examples:

1. lobby controls
2. gameplay controls
3. controller status surfaces
4. controller-specific UI hooks

### `src/game/domain/`

Owns pure gameplay rules, math, and types.

Examples:

1. score rules
2. win conditions
3. team assignment helpers
4. deterministic state transitions

This layer should stay testable without React or rendering.

### `src/game/engine/`

Owns runtime orchestration.

Examples:

1. ticking
2. lifecycle transitions
3. update ordering
4. system composition

### `src/game/systems/`

Owns focused gameplay systems when the game has enough scope to justify them.

Examples:

1. spawning
2. combat
3. pickups
4. abilities
5. scoring

### `src/game/adapters/`

Owns integration with frameworks and runtime services.

Examples:

1. Air Jam SDK integration
2. R3F integration
3. physics integration
4. audio integration
5. network and runtime bridges

Keep adapters thin. They should connect systems, not become the real game model.

### `src/game/ui/`

Owns reusable game-facing UI modules.

Examples:

1. score displays
2. status strips
3. overlays
4. icon wrappers

### `tests/`

Owns behavior-focused validation for the boundaries above.

Examples:

1. `tests/game/domain/` for pure rule tests
2. `tests/game/stores/` for pure state-transition tests
3. `tests/game/engine/` for focused runtime helper tests
4. `tests/game/adapters/` for transport-facing mapping and boundary tests
5. `tests/game/ui/` for shared game-facing UI primitives that can be validated without full app shells

## Starter Template Reference

The starter Pong template is the current best starter implementation of those boundaries.

It is a recommended reference, not a framework API.

Its useful starter modules look like:

1. `src/host/index.tsx` for host surface composition
2. `src/controller/index.tsx` for controller flow and input cadence
3. `src/game/stores/pong-store.ts` for networked store wiring
4. `src/game/stores/pong-store-state.ts` for pure state transitions
5. `src/game/engine/simulation.ts` for runtime orchestration
6. `src/game/engine/runtime-state.ts` for hot mutable runtime values
7. `src/game/adapters/controller-signals.ts` for host-to-controller transport-facing mapping
8. `src/game/ui/` for reusable game-facing presentation primitives shared by host and controller
9. `src/game/prefabs/arena/` for a folder-per-prefab contract with metadata, schema, preview, and runtime composition helper
10. `tests/game/` for the starter testing pattern that mirrors those same boundaries

If a starter module already demonstrates the boundary you need, extend it instead of introducing a second competing pattern.
If your game genuinely needs a different folder or module shape, preserve the boundary intent rather than copying Pong mechanically.

### `src/game/debug/`

Owns debug helpers and overlays.

Keep debug features removable and out of gameplay hot paths.

## Decision Rule

When adding code, ask:

1. is this pure game logic
2. is this runtime orchestration
3. is this framework integration
4. is this host-only or controller-only

Put the code where the answer is clearest.

## Refactor Rule

If a new feature would force host, controller, domain, and rendering concerns into one file, fix the boundary first or split the work into:

1. structural cleanup
2. feature implementation
