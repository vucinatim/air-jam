# Debug And Testing

Debuggability and testability should be designed in from the start.

## Debug Workflow

Use this order:

1. inspect the canonical Air Jam dev log stream first
2. use framework diagnostics second
3. use domain-level debug helpers third
4. add custom logs only where they add real value

## Canonical Dev Log Stream

The standard Air Jam development path writes one unified local stream to:

```text
.airjam/logs/dev-latest.ndjson
```

Use:

1. `pnpm exec air-jam-server logs --view=signal`
2. `pnpm exec air-jam-server logs`
3. direct file reads when you need the raw NDJSON stream

Important behavior:

1. the file resets when the Air Jam server process restarts
2. host, controller, server, and standard dev-runner events should land in the same stream on the normal development path
3. this should be the first place to look before adding ad hoc logs

## Query Strategy

Start with the narrowest useful identifier:

1. `traceId` for host bootstrap, reconnect, and room ownership stories
2. `roomId` for one full multiplayer room story
3. `controllerId` for one player/controller failure path
4. `runtimeKind` and `runtimeEpoch` for embedded runtime issues

Use `pnpm exec air-jam-server logs --view=signal` first when you want the quickest high-signal read.

Use `--process` when the likely failure is in one local process such as `platform`, `server`, or the active game dev server.

Use direct file reads or broader filtering when you need:

1. exact append order
2. full raw payloads
3. plumbing events that signal view intentionally hides

## Structure Rules

1. keep debug helpers under `src/game/debug/`
2. keep debug-only code isolated from hot gameplay paths
3. use structured logs instead of random console spam
4. make debug overlays removable without destabilizing core code

## Testing Rules

1. test pure domain logic with unit tests
2. test important gameplay systems with behavior tests
3. add focused tests when changing real behavior
4. prefer observable behavior over implementation details

## Starter Template Testing Pattern

If the project ships the starter testing layout, keep using it:

1. `tests/game/domain/` for pure gameplay rules
2. `tests/game/stores/` for pure state transitions
3. `tests/game/engine/` for focused runtime helpers
4. `tests/game/adapters/` for host/controller or transport-facing mapping
5. `tests/game/ui/` for shared game-facing UI primitives that can be validated without full app shells

Default order:

1. write the pure test first
2. add adapter or shared UI coverage second
3. add heavier integration tests only when the boundary really requires them

## Architecture Consequence

If game logic is too entangled with React, rendering, or transport to test cleanly, that usually means the structure should be improved.
