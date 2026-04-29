# Visual Proof And Host Staging Contract

These files are optional.

The primary machine-facing contract is still `src/game/contracts/agent.ts`.

Use this visual proof surface only when a game needs deterministic host staging or repeatable visual proof that should stay separate from the semantic game contract.

The visual proof workflow has two game-owned files:

1. `games/<game>/visual/contract.ts`
2. `games/<game>/visual/scenarios.ts`

Keep them separate on purpose.

## `visual/contract.ts`

This is the single source of truth for the optional browser-published host staging surface used by visual proof.

It defines:

1. the snapshot fields the harness can read
2. the typed host staging actions visual tooling can invoke
3. the payload validation for those actions

Rules:

1. keep it runtime-safe and browser-safe
2. do not import Playwright or scenario helpers here
3. expose only the minimal deterministic actions needed to stage scenarios
4. keep snapshot shape small and explicit
5. import browser/runtime-facing symbols from `@air-jam/harness/runtime`, not `@air-jam/harness/visual`
6. when bridge actions need the latest replicated game state in React code, use the store's supported `useLiveStateRef()` path instead of hand-rolled mirror refs
7. when semantic store actions need host-only local side effects, use the store's `useHostActionListener(...)` seam instead of queueing ephemeral local commands through replicated state
8. do not move core semantic player verbs here if they belong in `src/game/contracts/agent.ts`

The host should mount this contract through `<VisualHarnessRuntime gameId={gameMetadata.slug} />` instead of publishing ad hoc bridge globals directly.

## `visual/scenarios.ts`

This is the scenario entrypoint discovered by the repo visual runner and MCP capture flow.

It should:

1. import the shared bridge contract
2. call `defineVisualHarness({ bridge, scenarios })`
3. stage game-specific scenario flows with normal Playwright selectors
4. use `context.bridge.read()`, `context.bridge.waitFor(...)`, and `context.bridge.actions.*(...)` instead of stringly bridge calls
5. import scenario helpers and scenario-pack types from `@air-jam/harness/visual`

Keep selectors explicit.
Do not abstract away `getByTestId`, `getByRole`, or game-owned DOM knowledge unless repetition becomes a real maintenance problem.

## Host Pattern

The host should mount one runtime component and no raw bridge plumbing:

```tsx
import { VisualHarnessRuntime } from "@air-jam/harness/runtime";
import { gameMetadata } from "../airjam.config";

<VisualHarnessRuntime
  gameId={gameMetadata.slug}
  bridge={pongVisualHarnessBridge}
  context={{
    host,
    matchPhase,
    runtimeState,
    actions,
  }}
/>
```

That means the host no longer owns:

1. dev-only bridge publish effects
2. manual payload coercion
3. global key management
4. stringly action registration

Identity rule:

1. `gameMetadata.slug` is the canonical game id for visual proof runtime registration
2. `visual/contract.ts` and `visual/scenarios.ts` should not repeat that id in their definitions

## Scaffold Rule

Scaffolded games should ship the same layout:

1. `src/host/...` imports `../../visual/contract`
2. `visual/contract.ts` defines the shared bridge
3. `visual/scenarios.ts` owns scenario composition

Do not hide this under generic runtime config.
Visual proof behavior is game-local authoring and review logic, not topology or deployment configuration.

## Task-Backed Rule

`airjam.capture_visuals` is task-backed.

If the MCP client cannot execute task-backed tools, use a task-capable MCP client or run the equivalent Air Jam CLI or repo visual command directly.
