# Agent Gold Path

This is the shortest correct workflow for building and testing an Air Jam game.

## Read This First

1. `src/airjam.config.ts`
2. `src/game/contracts/agent.ts` if it exists
3. `docs/state-lanes-cookbook.md` when you are deciding where state or effects belong
4. `visual/contract.ts` and `visual/scenarios.ts` only if they exist
5. `docs/agent-mcp.md` when you need exact MCP operations

## Five-Step Mental Model

1. Need to see the game: use your built-in browser or in-app browser.
2. Need structured game state: use `airjam.open_game_session` then `airjam.read_game_session`.
3. Need to trigger a semantic game verb: use `airjam.invoke_game_session_action` with a `player:*` action id.
4. Need deterministic host staging or reset actions: use `host:*` session actions when the game exposes them.
5. Need repeatable screenshots or visual proof: use visual scenarios and `airjam.capture_visuals`.

## Launch Rule

1. If you are starting local dev yourself in a normal terminal, use `pnpm run dev`.
2. If your browser or preview tool wants to launch the app command itself and expects one foreground web process, use `pnpm run dev:preview`.
3. `pnpm run dev:preview` is a local HTTP browser-tool mode. If you need HTTPS/secure dev, use the normal `pnpm run dev -- --secure` flow instead.
4. Do not replace the Air Jam dev flow with raw `pnpm exec vite` unless you intentionally want frontend-only rendering without the local Air Jam backend.

## Canonical Files

`src/airjam.config.ts`
: Declares the runtime, metadata, controller path, semantic game contract, and optional visual scenarios.

`src/game/contracts/agent.ts`
: Owns the semantic agent contract. Keep snapshot projection and semantic actions here.

`visual/contract.ts`
: Optional browser-safe host staging surface for deterministic visual workflows and visual proof only.

`visual/scenarios.ts`
: Optional Playwright-side visual capture scenarios.

## Action Rules

1. `player:*` actions act like a player or a semantic controller verb.
2. `host:*` actions are deterministic host staging actions. They are optional and exist to support precise setup or visual proof, not to replace the semantic contract.
3. Store action dispatch returns an acknowledgement. Check it when outcome matters.
4. For `airjam.invoke_game_session_action`, prefer the returned normalized `outcome` over guessing from the raw acknowledgement alone. A missing host acknowledgement with observed committed state change is still a meaningful success signal, not an automatic rejection.
5. `ctx.actorId` always means the dispatcher. If host code dispatches with `useStore.useActions()`, then `ctx.actorId` is the host.
6. If host code intentionally needs to run the same semantic player action as controller `X`, use `useStore.asPlayer("X")` explicitly.
7. If a store action needs a host-only local side effect like audio, sim refs, or one-shot UI effects, use `useStore.useHostActionListener(...)` instead of replicated queue-and-drain state.
8. `resultDescription` is documentation for agents and humans about the expected semantic effect. It does not automatically become runtime result data.
9. If an action must return actual runtime result data, return `acceptAirJamAction(result)` from the store action and read the acknowledgement/result separately.
10. For host gameplay loops, prefer `useHostTick(...)` over hand-rolled `requestAnimationFrame` or `setInterval` loops unless you have a documented reason not to.

## Import Rules

1. Browser/runtime code imports harness runtime symbols from `@air-jam/harness/runtime`.
2. Visual scenario files import Playwright-side helpers from `@air-jam/harness/visual`.
3. If you need imperative live replicated state in React-owned agent code, use `useStore.useLiveStateRef()`.

## Browser + MCP Pairing

1. Browser is the visual truth.
2. Air Jam MCP is the agent-control and runtime-inspection path.
3. Use both together instead of forcing browser automation to do semantic work.

## Task-Backed Rule

`airjam.capture_visuals` is task-backed. Use a task-capable MCP client flow for it.
If your current client cannot run task-backed MCP tools, use a task-capable client or a direct Air Jam CLI/repo visual command instead of treating that limitation as a game bug.
