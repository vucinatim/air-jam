# Visual Harness Contract

Status: internal experimental reference.

Do not use this as the normal game-authoring path. New games and scaffolded projects should use browser/preview screenshots for visual inspection and `src/game/contracts/agent.ts` for deterministic game actions.

This document is kept only for maintainers working on the internal visual harness subsystem while [Visual Harness Isolation Plan](./visual-harness-isolation-plan-2026-05-02.md) records the prerelease decision to ghost it from the public framework story.

The primary machine-facing contract is `src/game/contracts/agent.ts`.

Use this visual proof surface only when a game needs repeatable visual proof or a small runtime-local bootstrap surface that should stay separate from the semantic agent contract.

Deterministic host-side staging is part of the semantic agent contract now. If a scenario needs a precise host verb like `finishMatch`, `returnToLobby`, or `seedRound`, publish it with `agentAction.host(...)` and invoke it through `context.agent.invoke("host:...")`.

The visual proof workflow always has one game-owned scenario file:

1. `games/<game>/src/game/contracts/visual-scenarios.ts`

It only needs a second file, `games/<game>/src/game/contracts/visual-bridge.ts`, when the game truly requires a small runtime-local bridge.

## `src/game/contracts/visual-bridge.ts` (Optional)

This is the single source of truth for the optional browser-published runtime-local bridge surface used by visual proof.

It defines:

1. the snapshot fields the harness can read
2. only the typed bridge actions visual tooling truly cannot express through the semantic agent contract
3. the payload validation for those actions

Rules:

1. keep it runtime-safe and browser-safe
2. do not import Playwright or scenario helpers here
3. expose only the minimal runtime-local actions that truly cannot be modeled as semantic `player:*` or `host:*` actions
4. keep snapshot shape small and explicit
5. import browser/runtime-facing symbols from `@air-jam/harness/runtime`, not `@air-jam/harness/visual`
6. when bridge actions need the latest replicated game state in React code, use the store's supported `useLiveStateRef()` path instead of hand-rolled mirror refs
7. when semantic store actions need host-only local side effects, use the store's `useHostActionListener(...)` seam instead of queueing ephemeral local commands through replicated state
8. do not move core semantic player or host verbs here if they belong in `src/game/contracts/agent.ts`
9. prefer canonical semantic staging through `context.agent.invoke(...)` from scenarios whenever the agent contract already exposes the needed action

The host should mount this contract through `<VisualHarnessRuntime gameId={gameMetadata.slug} />` instead of publishing ad hoc bridge globals directly. When the game exposes semantic host actions, pass both the contract and the synced stores that own those actions.

## `src/game/contracts/visual-scenarios.ts`

This is the scenario entrypoint discovered by the repo visual runner and MCP capture flow.

It should:

1. import the semantic agent contract
2. call `defineVisualHarness({ agent, scenarios })` by default
3. add `bridge` only when the game actually needs a runtime-local bridge
4. stage game-specific scenario flows with normal Playwright selectors
5. use `context.agent.invoke(...)` and `context.agent.waitFor(...)` for canonical semantic setup and waits
6. use `context.bridge.read()` or `context.bridge.waitFor(...)` only for runtime-local visual/bootstrap state
7. use `context.bridge.actions.*(...)` only when the scenario needs runtime-local visual/bootstrap behavior that still does not belong in the semantic agent contract
8. import scenario helpers and scenario-pack types from `@air-jam/harness/visual`

Keep selectors explicit.
Do not abstract away `getByTestId`, `getByRole`, or game-owned DOM knowledge unless repetition becomes a real maintenance problem.

## Host Pattern

The host should mount one runtime component and no raw bridge plumbing:

```tsx
import { VisualHarnessRuntime } from "@air-jam/harness/runtime";
import { gameMetadata } from "../airjam.config";

<VisualHarnessRuntime
  gameId={gameMetadata.slug}
  agent={{
    contract: agentContract,
    stores: {
      default: useGameStore,
    },
  }}
  bridge={pongVisualHarnessBridge}
  context={{
    host,
    matchPhase,
    runtimeState,
  }}
/>;
```

That means the host no longer owns:

1. dev-only bridge publish effects
2. manual payload coercion
3. global key management
4. stringly action registration

Identity rule:

1. `gameMetadata.slug` is the canonical game id for visual proof runtime registration
2. `src/game/contracts/visual-bridge.ts` and `src/game/contracts/visual-scenarios.ts` should not repeat that id in their definitions

## Scaffold Rule

Scaffolded games should ship the same layout:

1. `src/game/contracts/visual-scenarios.ts` always owns scenario composition
2. `src/host/...` imports `../game/contracts/visual-bridge` only when a bridge exists
3. `src/game/contracts/visual-bridge.ts` exists only when the game needs true runtime-local visual/bootstrap behavior

Do not hide this under generic runtime config.
Visual proof behavior is game-local authoring and review logic, not topology or deployment configuration.

## Task-Backed Rule

`airjam.capture_visuals` is task-backed.

If the MCP client cannot execute task-backed tools, use a task-capable MCP client or run the equivalent Air Jam CLI or repo visual command directly.
