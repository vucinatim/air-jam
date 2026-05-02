---
name: debug-and-test
description: Use when debugging or validating an Air Jam project so diagnostics, logging, and tests stay intentional, structured, and aligned with the project architecture.
---

# Debug And Test

Use this skill when adding debug helpers, using logs, or deciding what to test.

## Read First

1. `docs/debug-and-testing.md`
2. `docs/development-loop.md`
3. `docs/generated/unified-dev-logs.md`

## Debug Order

1. inspect the canonical Air Jam dev log stream first
2. use framework diagnostics second
3. use domain-level debug helpers third
4. add custom logs only when they add clear value

## Canonical Log Workflow

Use the unified Air Jam log stream early when debugging host/controller/server issues.

Key facts:

1. the canonical file is `.airjam/logs/dev-latest.ndjson`
2. it resets when the Air Jam server process restarts
3. `pnpm exec air-jam-server logs` is the preferred path
4. direct file reads are valid when you need the raw stream
5. standard dev-runner failures from Vite and similar tools should also appear there as `workspace` events
6. this should usually come before adding new temporary logs

Query order:

1. start with `pnpm exec air-jam-server logs --view=signal`
2. use `--trace` for host-session stories
3. use `--room` for one multiplayer room story
4. use `--controller` for one player/controller path
5. use `--runtime` and `--epoch` for embedded runtime problems
6. use `--process` when the likely failure is in one local dev process such as `platform`, `server`, or the active game
7. use `--source` when you already know which producer layer you need
8. fall back to raw NDJSON when signal view is still not enough

## Test Order

1. pure domain logic with unit tests
2. focused gameplay systems with behavior tests
3. targeted integration coverage only where the boundary really matters

If the starter testing layout exists, prefer:

1. `tests/game/domain/`
2. `tests/game/stores/`
3. `tests/game/engine/`
4. `tests/game/adapters/`
5. `tests/game/ui/`

## Structure Rules

1. keep debug helpers under `src/game/debug/`
2. keep debug-only code out of hot gameplay paths
3. prefer structured logs over ad hoc console noise
4. keep core logic testable without rendering where practical

## Anti-Patterns

1. bolting debug code directly into render hot paths
2. waiting until the project is tangled before writing tests
3. testing implementation details instead of behavior
