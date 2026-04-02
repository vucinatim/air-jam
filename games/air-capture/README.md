# Air Capture

`air-capture` is the larger first-party Air Jam reference game for team-based 3D multiplayer. It is meant to prove the framework against a richer runtime than `pong` while still teaching the same architecture boundaries.

## Local Commands

```bash
pnpm --filter air-capture dev
pnpm --filter air-capture test
pnpm --filter air-capture typecheck
pnpm --filter air-capture build
```

## Structure

```text
src/
  app.tsx                     # runtime surface switch
  airjam.config.ts            # app metadata and runtime config
  host/
    index.tsx                 # host-owned shell, state wiring, and side effects
    components/               # host overlays and live match chrome
  controller/
    index.tsx                 # controller-owned shell and input publishing
    components/               # header and per-phase controller UI
  game/
    audio/                    # runtime audio owners, manifests, and music orchestration
    domain/                   # pure team, slot, readiness, and CTF rule helpers
    stores/                   # replicated match/player/world/debug state
    engine/                   # runtime orchestration hooks plus pure ship/projectile/lifecycle/runtime helpers
    prefabs/
      arena/                  # canonical arena prefab contract and composition
    ui/                       # shared game-facing HUD overlays
    debug/                    # host/debug tooling and cheat surfaces
    components/
      entities/               # runtime leaf gameplay actors and collections
      models/                 # reusable render models
      effects/                # reusable render effects and explosions
    abilities/                # pickup and ability implementations
    bot-system/               # bot coordination/runtime control
    hooks/                    # remaining narrow gameplay hooks
tests/
  game/
    domain/                   # pure rule tests
    stores/                   # pure state transition tests
```

## Boundary Rules

- `src/host/index.tsx` and `src/controller/index.tsx` are the only runtime owner entry files.
- `src/game/domain/` should stay readable without React, rendering, or store wiring.
- `src/game/audio/` owns runtime audio once per surface; entities, prefabs, and engine hooks consume local audio facades instead of calling `useAudio(...)` directly.
- `src/game/stores/` owns replicated state and thin store wiring around pure transition helpers and explicit interaction outcomes.
- `src/game/engine/` owns hot runtime orchestration hooks plus pure ship/projectile/lifecycle/runtime stepping helpers, not lobby or shell UI.
- `src/game/prefabs/arena/` owns the canonical arena prefab contract (`schema`, `preview`, `prefab`, `paint`).
- `src/game/prefabs/` owns world composition entry surfaces, not debug/editor concerns.
- `src/game/debug/` is where host-only cheat, recorder, and inspection surfaces belong.
- `src/game/components/entities/` owns runtime leaf gameplay actors, not their primary frame orchestration.
- `src/game/components/models/` owns reusable render models.
- `src/game/components/effects/` owns reusable render effects and explosions.

## Testing Direction

The test surface is intentionally small and high-value. Add tests to pure domain and store seams before considering render-heavy coverage.

Current baseline:

- `tests/game/domain/` for readiness, slot, team, and CTF rule coverage
- `tests/game/engine/` for pure ship/projectile flight, lifecycle, runtime, weapon, audio, and impact helpers
- `tests/game/prefabs/` for prefab contract and schema coverage
- `tests/game/stores/` for match transitions and assignment behavior
