# Visual Proof And Host Staging

These files are optional.

Use them only when the semantic game contract in `src/game/contracts/agent.ts` is not enough by itself because you need deterministic host staging or repeatable visual proof.

The visual proof workflow has two game-owned files:

1. `visual/contract.ts`
2. `visual/scenarios.ts`

## `visual/contract.ts`

This is the single source of truth for the optional browser-published host staging surface that visual proof can read and invoke.

Put here:

1. the snapshot shape
2. typed host staging actions
3. payload validation
4. short action metadata so agents can discover what each action does

Mount `<VisualHarnessRuntime gameId={gameMetadata.slug} />` from the host and keep the host free of raw bridge `useEffect` plumbing.

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

1. publish clear verbs like `returnToLobby`, `startMatch`, `setScore`, or `spawnBot`
2. keep payloads small and explicit
3. add action descriptions and payload descriptions in the bridge definition
4. expose host-side reset actions when your game has multi-phase flows, so agents do not need to restart dev just to move back to a testable state
5. do not move core semantic game verbs here if they belong in `src/game/contracts/agent.ts`

## `visual/scenarios.ts`

This is the scenario entrypoint used by repo and MCP visual capture.

Use:

1. `defineVisualHarness({ bridge, scenarios })`
2. `context.bridge.actions.*(...)` for deterministic host staging
3. `context.bridge.waitFor(...)` for bridge-driven waits
4. normal Playwright selectors for game-specific UI flows

Game identity rule:

1. treat `gameMetadata.slug` in `src/airjam.config.ts` as the canonical game id
2. pass that id into `<VisualHarnessRuntime gameId={gameMetadata.slug} />`
3. do not repeat `gameId` inside visual bridge or visual scenario pack definitions

Keep selectors explicit and game-owned.

## Rule

Do not put visual-proof behavior into runtime config files.
It is game-owned authoring logic, not topology configuration.

## Task-Backed Rule

`airjam.capture_visuals` is task-backed.

If your MCP client cannot execute task-backed tools, switch to a task-capable client or run the equivalent Air Jam CLI or repo visual command directly.
