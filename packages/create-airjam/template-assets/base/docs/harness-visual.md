# Visual Proof And Host Staging

These files are optional.

Start with `src/game/contracts/visual-scenarios.ts` only.

Add `src/game/contracts/visual-bridge.ts` only if a game truly needs a small runtime-local bridge that cannot be expressed cleanly through the semantic agent contract in `src/game/contracts/agent.ts`.

Deterministic host-side staging belongs in the semantic agent contract now. If a scenario needs a precise host verb like `finishMatch`, `returnToLobby`, or `seedRound`, publish it with `agentAction.host(...)` and invoke it through `context.agent.invoke("host:...")`.

## `src/game/contracts/visual-bridge.ts` (Optional)

This is the single source of truth for the optional browser-published runtime-local bridge surface that visual proof can read and invoke.

Put here:

1. the minimal runtime-local snapshot shape
2. only the bridge actions that truly cannot live in the semantic agent contract
3. payload validation
4. short action metadata so agents can discover what each action does

Mount `<VisualHarnessRuntime gameId={gameMetadata.slug} />` from the host and keep the host free of raw bridge `useEffect` plumbing. When the game exposes semantic host actions, also pass the contract plus the synced stores that own those actions:

```tsx
<VisualHarnessRuntime
  gameId={gameMetadata.slug}
  agent={{
    contract: agentContract,
    stores: {
      default: useGameStore,
    },
  }}
  bridge={visualBridge}
  context={...}
/>
```

Import rule:

1. browser/runtime code should import `VisualHarnessRuntime`, `bridgeAction`, and `defineVisualHarnessBridge` from `@air-jam/harness/runtime`
2. visual scenario files should import scenario helpers and `defineVisualHarness(...)` from `@air-jam/harness/visual`

Live state rule:

1. if your bridge snapshot or actions need the latest replicated game store outside normal JSX rendering, use the store's supported `useLiveStateRef()` hook
2. use raw `getState()` / `subscribe(...)` only when you truly need imperative non-React access

Host effect rule:

1. if a semantic store action needs a host-only local side effect like spawning into a sim ref, playing a sound, or kicking a one-shot animation, use the store's `useHostActionListener(...)` seam
2. do not push ephemeral local-only commands through replicated state just to trigger host runtime effects

Preferred action shape:

1. publish clear runtime-local verbs only for true browser/runtime-local needs like `spawnBot`, `seedDebugState`, or visual-only toggles
2. keep payloads small and explicit
3. add action descriptions and payload descriptions in the bridge definition
4. do not move core semantic game verbs here if they belong in `src/game/contracts/agent.ts`
5. prefer `context.agent.invoke("player:...")` or `context.agent.invoke("host:...")` from scenarios whenever the semantic agent contract already describes the action cleanly

## `src/game/contracts/visual-scenarios.ts`

This is the scenario entrypoint used by repo and MCP visual capture.

Use:

1. `defineVisualHarness({ agent, scenarios })` as the default shape
2. `defineVisualHarness({ agent, bridge, scenarios })` only when the game truly needs a runtime-local bridge
3. `context.agent.invoke(...)` and `context.agent.waitFor(...)` for canonical semantic setup and waits
4. `context.bridge.read()` or `context.bridge.waitFor(...)` only for runtime-local visual/bootstrap state that is not part of the semantic agent snapshot
5. `context.bridge.actions.*(...)` only when the scenario truly needs runtime-local behavior that cannot be modeled cleanly as a semantic `player:*` or `host:*` action
6. normal Playwright selectors for game-specific UI flows

Game identity rule:

1. treat `gameMetadata.slug` in `src/airjam.config.ts` as the canonical game id
2. pass that id into `<VisualHarnessRuntime gameId={gameMetadata.slug} />`
3. do not repeat `gameId` inside visual bridge or visual scenario pack definitions

Authoring rule:

1. keep `src/game/contracts/visual-scenarios.ts` as a thin consumer of the semantic agent contract
2. do not invent a second semantic control language inside the bridge
3. if scenario setup can be described as a semantic game verb, add it to `src/game/contracts/agent.ts` instead of adding a bridge action

Keep selectors explicit and game-owned.

## Rule

Do not put visual-proof behavior into runtime config files.
It is game-owned authoring logic, not topology configuration.

## Task-Backed Rule

`airjam.capture_visuals` is task-backed.

If your MCP client cannot execute task-backed tools, switch to a task-capable client or run the equivalent Air Jam CLI or repo visual command directly.
