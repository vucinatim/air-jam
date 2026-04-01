---
name: game-architecture
description: Use when creating or refactoring gameplay code in an Air Jam project and you need guidance on host vs controller vs domain boundaries, modular structure, and when to refactor before implementing.
---

# Game Architecture

Use this skill when adding new systems or moving code between boundaries.

## Read First

1. `docs/generated/project-structure.md`
2. `docs/generated/architecture.md`

## Boundary Model

Prefer this split:

1. `src/airjam.config.ts` for runtime metadata such as `controllerPath` and input schema
2. `src/app.tsx` for mounting explicit host/controller runtime boundaries
3. `src/host/` for host-only composition
4. `src/controller/` for controller-only composition
5. `src/game/domain/` for pure rules
6. `src/game/engine/` for orchestration
7. `src/game/systems/` for focused gameplay systems
8. `src/game/adapters/` for framework integration
9. `src/game/ui/` for reusable game-facing UI
10. `src/game/debug/` for debug helpers

Keep runtime ownership explicit:

1. mount `airjam.Host` / `airjam.Controller` once at the boundary
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
