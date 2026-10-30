---
name: game-architecture
description: Use when creating or refactoring gameplay code in an Air Jam project and you need guidance on host vs controller vs domain boundaries, modular structure, and when to refactor before implementing.
---

# Game Architecture

Use this skill when adding new systems or moving code between boundaries.

## Read First

1. `docs/airjam/generated/project-structure.md`
2. `docs/airjam/generated/architecture.md`

## Boundary Model

Prefer this split:

1. `src/airjam.config.ts` for the framework-free `defineAirJamGame` declaration from `@air-jam/sdk/core`: metadata, stores, simulation, input, bindings, agent and testing path
2. `src/app.tsx` for `createAirJamApp(airjam, { runtime })` and mounting its host/controller runtime boundaries
3. `src/host/` for host-only composition
4. `src/controller/` for controller-only composition
5. `src/game/domain/` for pure rules
6. `src/game/engine/` for orchestration
7. `src/game/systems/` for focused gameplay systems
8. `src/game/adapters/` for framework integration
9. `src/game/ui/` for reusable game-facing UI
10. `src/game/debug/` for debug helpers

Keep runtime ownership explicit:

1. mount `app.Host` / `app.Controller` from the React binding once at the boundary
2. use consumer hooks like `useAirJamHost()` and `useAirJamController()` only below that boundary
3. keep gameplay code out of runtime setup and transport bootstrap

## Decision Rule

Ask:

1. is this pure gameplay logic
2. is this runtime orchestration
3. is this rendering integration
4. is this host-only or controller-only

Put the code where the answer is clearest.

## Refactor-First Rule

If new work would harden a mixed boundary, split the structure first or split the task into:

1. boundary cleanup
2. feature implementation

## Anti-Patterns

1. one large file that mixes host, controller, domain, and rendering concerns
2. React components as the only home for gameplay logic
3. adapter code becoming the real game model

## One game declaration

Read `airjam.inspect_game` for the versioned `declaration`, including
`declaration.agent`, controls, controller path and metadata. The game's
`src/airjam.config.ts` exports `airjam = defineAirJamGame(...)` from
`@air-jam/sdk/core`; agent helpers also come from core. Keep React, the SDK
root, TSX and CSS out of its graph. `app.tsx` alone binds it with
`createAirJamApp(airjam, { runtime })`.

Capacity comes from `metadata.maxPlayers`. The `testing` path names a module
exporting `testing = defineAirJamTesting({ player, profiles, visual })` from
`@air-jam/devtools/testing`. Profiles author scripted policies only; a declared
player is offered as the reserved `model` policy in every profile. Optional
`visual.scenarios` uses the game's declared agent. Do not duplicate identity
in template flags or read config source with regular expressions.

## Declared settings

Declare creator tuning values with `defineAirJamSettings` and `setting` from
`@air-jam/sdk/core`, in the game declaration's `settings` field. Remove the
constants they replace. Read values in simulation create/step/observe contexts
and typed action contexts; host rendering uses `useAirJamSettings`. Controllers
show copies in replicated state. Lobby player choices stay store state.

Inspect descriptors in `airjam.inspect_game` → `declaration.settings`.
Use `airjam.read_game_settings({ gameSessionId })` for live values and revision,
then `airjam.update_game_settings({ gameSessionId, patch, expectedRevision })`
under host authority. Only `live: true` values can change; non-live values go
in `airjam.start_game_run({ settings, ... })` for a fresh room. Stale revisions
require a fresh read. Input log version 2 records initial values and ordered
settings updates for replay. See `docs/airjam/generated/settings.md`.
