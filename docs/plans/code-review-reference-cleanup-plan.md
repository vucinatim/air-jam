# Code Review Reference Cleanup Plan

Status: completed  
Created: 2026-04-20  
Scope: `games/code-review`, generated scaffold template parity

## Goal

Bring `code-review` up to the same authoring quality bar as the cleaned Pong template without changing the game's design.

The target is a game that reads as a proper Air Jam reference implementation:

1. `host/` contains host-only runtime surface code
2. `controller/` contains controller-only phone surface code
3. `game/` contains shared game contracts, domain rules, engine code, replicated stores, and shared presentation
4. large surface entry files are small orchestration hubs instead of mixed logic/UI/runtime files
5. SDK usage is canonical and hard to misuse
6. scaffold archives are regenerated after each structural change

## Current Problems

### Host Surface

`games/code-review/src/host/index.tsx` is roughly 700 lines and currently owns too many responsibilities:

1. audio runtime and music playlist mounting
2. host session reads
3. canvas setup and animation loop
4. sprite loading and tint-cache management
5. audio mute state and SFX dispatch
6. clipboard copy state
7. connected player/team/participant derivation
8. lobby readiness and join controls
9. connected-player sync
10. match-end transition checks
11. simulation stepping
12. rendering
13. visual harness runtime context
14. lobby overlay UI
15. ended overlay UI
16. paused overlay UI
17. preview controller workspace

This is structurally similar to old Pong before the host cleanup pass.

### Controller Surface

`games/code-review/src/controller/index.tsx` is roughly 575 lines and mixes:

1. controller session reads
2. input writer and controller tick loop
3. gyro math and permission flow
4. movement, defend, punch, and cooldown refs
5. store selectors
6. team/player derivation
7. lifecycle permissions and intents
8. shell header UI
9. ended UI
10. lobby wiring
11. paused UI
12. gameplay controls UI

The gyro/input runtime logic is especially hard to scan inside the view file.

### Game Folder

The game folder has the same pre-cleanup shape Pong used to have:

```txt
game/
  input.ts
  match-config.ts
  sounds.ts
  domain/
  engine/
  stores/
  ui/
```

Problems:

1. `input.ts` mixes SDK input contract with punch timing constants.
2. `sounds.ts` is a runtime contract but lives at the game root.
3. `match-config.ts` is a single constant at the game root.
4. tests currently live inside `src/game`.
5. `controller/constants.ts` contains only a shared presentation class.

## Target Shape

Keep the same three top-level pillars as Pong:

```txt
src/
  host/
  controller/
  game/
```

Target game folder:

```txt
game/
  contracts/
    input.ts
    sounds.ts

  domain/
    combat-rules.ts
    match-readiness.ts
    match-rules.ts
    team-assignments.ts
    team-slots.ts
  engine/
    constants.ts
    render.ts
    runtime-state.ts
    simulation.ts
    sprites.ts
    types.ts

  stores/
    index.ts
    code-review-store.ts
    code-review-store-state.ts
    code-review-store-types.ts

  ui/
    team-slot-tile.tsx
```

Notes:

1. `game/contracts/input.ts` owns only the controller input schema and inferred input type.
2. Punch timing belongs outside the input contract, likely in `game/domain/combat-rules.ts`.
3. `MATCH_POINTS_TO_WIN` belongs in `game/domain/match-rules.ts`.
4. `sounds.ts` belongs in `game/contracts/sounds.ts`.
5. shared derived team data should stay close to the surface that owns it unless host and controller need the exact same projection.

Target host folder:

```txt
host/
  index.tsx
  components/
    ended-screen.tsx
    lobby-screen.tsx
    paused-overlay.tsx
    playing-screen.tsx
  hooks/
    use-code-review-audio.ts
    use-code-review-canvas.ts
    use-code-review-host-runtime.ts
    use-code-review-host-teams.ts
    use-code-review-sprites.ts
    use-clipboard-copy.ts
```

Target controller folder:

```txt
controller/
  index.tsx
  components/
    classes.ts
    controller-header.tsx
    ended-panel.tsx
    lobby-panel.tsx
    paused-panel.tsx
    playing-controls.tsx
  hooks/
    use-code-review-controller-input.ts
    use-code-review-controller-teams.ts
    use-code-review-gyro.ts
```

## Phase 1: Game Folder Cleanup

Goal: make shared game code as self-documenting as Pong before touching host/controller runtime structure.

Steps:

1. Move `game/input.ts` to `game/contracts/input.ts`.
2. Move `game/sounds.ts` to `game/contracts/sounds.ts`.
3. Move `MATCH_POINTS_TO_WIN` from `game/match-config.ts` to `game/domain/match-rules.ts`.
4. Move `PUNCH_DURATION_MS` and `PUNCH_COOLDOWN_MS` out of the input contract to `game/domain/combat-rules.ts`.
5. Update imports in host, controller, engine, tests, and config.
6. Move `src/game/domain/team-assignments.test.ts` to `tests/game/domain/team-assignments.test.ts`.
7. Move `src/game/engine/simulation.test.ts` to `tests/game/engine/simulation.test.ts`.
8. Update README structure and any template docs that reference old paths.
9. Run `pnpm --filter code-review typecheck`.
10. Run `pnpm --filter code-review test`.
11. Regenerate and verify scaffold templates.

Completed:

1. `input.ts` and `sounds.ts` now live under `game/contracts/`.
2. match and combat constants now live under `game/domain/`.
3. source tests moved from `src/game` to `tests/game`.
4. stale imports were removed.

Acceptance:

1. no production test files remain under `games/code-review/src`
2. no imports reference `game/input`, `game/sounds`, or `game/match-config`
3. input contract contains no gameplay timing constants

## Phase 2: Controller Cleanup

Goal: make `controller/index.tsx` a small surface hub.

Steps:

1. Move `PRESS_FEEL_CLASS` from `controller/constants.ts` to `controller/components/classes.ts`, or inline if only one component uses it after extraction.
2. Extract gyro math and permission flow to `controller/hooks/use-code-review-gyro.ts`.
3. Extract input refs, punch cooldowns, `useControllerTick`, and input writer logic to `controller/hooks/use-code-review-controller-input.ts`.
4. Extract connected-player/team/readiness derivation to `controller/hooks/use-code-review-controller-teams.ts`.
5. Extract shell header to `controller/components/controller-header.tsx`.
6. Extract ended view to `controller/components/ended-panel.tsx`.
7. Extract paused view to `controller/components/paused-panel.tsx`.
8. Extract gameplay buttons to `controller/components/playing-controls.tsx`.
9. Keep `controller/index.tsx` as the route surface, orientation switch, and phase switch.

Completed:

1. `controller/index.tsx` is now a small surface hub.
2. gyro permission/math lives in `controller/hooks/use-code-review-gyro.ts`.
3. controller input refs/tick/cooldowns live in `controller/hooks/use-code-review-controller-input.ts`.
4. phase-specific JSX lives in controller components.

Acceptance:

1. `controller/index.tsx` no longer contains gyro math helpers.
2. `controller/index.tsx` no longer owns input writer refs directly.
3. phase-specific JSX lives in named components.
4. gameplay controls receive only runtime callbacks or self-consume store/session state.

## Phase 3: Host Cleanup

Goal: make `host/index.tsx` a small host runtime hub.

Steps:

1. Extract canvas setup and context access to `host/hooks/use-code-review-canvas.ts`.
2. Extract sprite loading, tint cache, and overlay sprite helper to `host/hooks/use-code-review-sprites.ts`.
3. Extract SFX, music playing state, match-start bell, and mute state to `host/hooks/use-code-review-audio.ts`.
4. Extract connected players, participants, bot counts, occupancy, readiness, and slot maps to `host/hooks/use-code-review-host-teams.ts`.
5. Extract clipboard copy helper to `host/hooks/use-clipboard-copy.ts`.
6. Extract runtime refs and simulation/render loop to `host/hooks/use-code-review-host-runtime.ts`.
7. Consider replacing the custom `requestAnimationFrame` loop with canonical `useHostTick`.
8. Extract lobby overlay to `host/components/lobby-screen.tsx`.
9. Extract ended overlay to `host/components/ended-screen.tsx`.
10. Extract pause overlay to `host/components/paused-overlay.tsx`.
11. Keep `host/index.tsx` responsible for `AudioRuntime`, visual harness, music playlist, surface composition, phase switching, and preview workspace.

Completed:

1. `host/index.tsx` is now a small host composition hub.
2. canvas, sprites, audio, clipboard, team derivation, and host runtime loop live in focused hooks.
3. the raw custom animation loop was replaced with canonical `useHostTick` fixed mode.
4. lobby, ended, paused, and playing canvas UI live in named components.

Acceptance:

1. `host/index.tsx` no longer contains sprite loading loops.
2. `host/index.tsx` no longer owns the raw animation loop directly unless there is a documented reason not to use `useHostTick`.
3. lobby/ended/pause JSX lives in named components.
4. host runtime state refs and HP display sync live in one focused hook.

## Phase 4: Final Polish And Validation

Steps:

1. Remove leftover tiny utility files whose contents are now single-use.
2. Confirm no `ControllerRemoteAudioRuntime` usage exists.
3. Confirm `AudioRuntime` is mounted once per surface where audio is used.
4. Confirm `SurfaceViewport` is the only controller orientation owner.
5. Update `games/code-review/README.md`.
6. Regenerate scaffold templates.
7. Run:

```bash
pnpm --filter code-review typecheck
pnpm --filter code-review test
pnpm --filter code-review build
pnpm --filter create-airjam templates:check
pnpm --filter create-airjam ai-pack:check
git diff --check
```

## Non-Goals

1. No gameplay redesign.
2. No sprite/art/audio asset changes.
3. No scoring or combat balancing changes unless a test exposes a real bug.
4. No new SDK abstractions unless the refactor exposes repeated cross-game structure that belongs in the SDK.
5. No extra folders merely for aesthetics; every new folder must clarify ownership.

## Open Decisions

1. Should Code Review remove the host mute button and rely only on platform audio settings, matching the simpler game-template direction?
2. Should the host runtime loop move fully to `useHostTick`, or does the current sprite/canvas rendering need a custom frame loop temporarily?
3. Should `teams-snapshot` be shared in `game/domain` like Pong, or split into host/controller-specific hooks because Code Review participant derivation is heavier?
4. Should the game keep only `crowd` as `MusicPlaylist` music, or should more tracks be added later to exercise the SDK playlist path?
