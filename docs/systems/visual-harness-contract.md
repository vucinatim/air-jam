# Visual Harness Contract

The visual harness has two game-owned files:

1. `games/<game>/visual/contract.ts`
2. `games/<game>/visual/scenarios.ts`

Keep them separate on purpose.

## `visual/contract.ts`

This is the single source of truth for the host bridge.

It defines:

1. the snapshot fields the harness can read
2. the typed host actions the harness can invoke
3. the payload validation for those actions

Rules:

1. keep it runtime-safe and browser-safe
2. do not import Playwright or scenario helpers here
3. expose only the minimal deterministic actions needed to stage scenarios
4. keep snapshot shape small and explicit

The host should consume this contract through `useVisualHarnessBridge(...)` instead of publishing ad hoc bridge globals directly.

## `visual/scenarios.ts`

This is the scenario entrypoint discovered by the repo visual runner.

It should:

1. import the shared bridge contract
2. call `defineVisualHarness({ gameId, bridge, scenarios })`
3. stage game-specific scenario flows with normal Playwright selectors
4. use `context.bridge.read()`, `context.bridge.waitFor(...)`, and `context.bridge.actions.*(...)` instead of stringly bridge calls

Keep selectors explicit.
Do not abstract away `getByTestId`, `getByRole`, or game-owned DOM knowledge unless repetition becomes a real maintenance problem.

## Host Pattern

The host should contain one bridge hook call and no raw bridge plumbing:

```tsx
useVisualHarnessBridge(pongVisualHarnessBridge, {
  host,
  matchPhase,
  runtimeState,
  actions,
});
```

That means the host no longer owns:

1. dev-only bridge publish effects
2. manual payload coercion
3. global key management
4. stringly action registration

## Scaffold Rule

Scaffolded games should ship the same layout:

1. `src/host/...` imports `../../visual/contract`
2. `visual/contract.ts` defines the shared bridge
3. `visual/scenarios.ts` owns scenario composition

Do not hide this under generic runtime config.
Visual harness behavior is game-local authoring and review logic, not topology or deployment configuration.
