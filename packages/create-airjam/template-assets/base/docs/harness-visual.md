# Harness Visual Workflows

The Air Jam harness visual workflow has two game-owned files:

1. `visual/contract.ts`
2. `visual/scenarios.ts`

## `visual/contract.ts`

This is the single source of truth for what the harness visual layer can read and do.

Put here:

1. the snapshot shape
2. typed bridge actions
3. payload validation
4. short action metadata so agents can discover what each action does

Mount `<VisualHarnessRuntime />` from the host and keep the host free of raw bridge `useEffect` plumbing.

Preferred action shape:

1. publish clear verbs like `returnToLobby`, `startMatch`, `setScore`, or `spawnBot`
2. keep payloads small and explicit
3. add action descriptions and payload descriptions in the bridge definition
4. expose host-side reset actions when your game has multi-phase flows, so agents do not need to restart dev just to move back to a testable state

## `visual/scenarios.ts`

This is the scenario entrypoint used by repo and MCP visual capture.

Use:

1. `defineVisualHarness({ gameId, bridge, scenarios })`
2. `context.bridge.actions.*(...)` for deterministic host staging
3. `context.bridge.waitFor(...)` for bridge-driven waits
4. normal Playwright selectors for game-specific UI flows

Keep selectors explicit and game-owned.

## Rule

Do not put harness visual behavior into runtime config files.
It is a game contract, not topology configuration.
