# Visual Harness

The visual harness has two game-owned files:

1. `visual/contract.ts`
2. `visual/scenarios.ts`

## `visual/contract.ts`

This is the single source of truth for what the harness can read and do.

Put here:

1. the snapshot shape
2. typed bridge actions
3. payload validation

Use `useVisualHarnessBridge(...)` from the host and keep the host free of raw bridge `useEffect` plumbing.

## `visual/scenarios.ts`

This is the scenario entrypoint used by repo visual capture.

Use:

1. `defineVisualHarness({ gameId, bridge, scenarios })`
2. `context.bridge.actions.*(...)` for deterministic host staging
3. `context.bridge.waitFor(...)` for bridge-driven waits
4. normal Playwright selectors for game-specific UI flows

Keep selectors explicit and game-owned.

## Rule

Do not put visual harness behavior into runtime config files.
It is a game contract, not topology configuration.
