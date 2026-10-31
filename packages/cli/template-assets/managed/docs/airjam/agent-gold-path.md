# Agent Gold Path

This is the shortest correct workflow for building and testing an Air Jam game.

## Read This First

1. `src/airjam.config.ts`
2. `src/game/contracts/agent.ts` if it exists
3. `docs/airjam/state-lanes-cookbook.md` when you are deciding where state or effects belong
4. `docs/airjam/agent-mcp.md` when you need exact MCP operations

## Five-Step Mental Model

1. Need to see the game: use your built-in browser or in-app browser.
2. Need structured game state: use `airjam.open_game_session` then `airjam.read_game_session`.
3. Need to trigger a semantic game verb: use `airjam.invoke_game_session_action` with a `player:*` action id.
4. Need deterministic host staging or reset actions: use `host:*` session actions when the game exposes them.
5. Need visual proof: use the embedded browser when available, otherwise call `airjam.capture_game_session_visuals` on the room-owning session.

## Launch Rule

1. Treat project creation and package-manager mutation as single-writer work.
   Wait for the active scaffold/install command to finish; never start
   concurrent installs against the same workspace.
1. Use `pnpm run dev` for normal local development.
1. Use the committed `.claude/launch.json` when Claude Code Desktop preview launches the app. It runs `pnpm run dev -- --preview-managed` so Claude Preview sees Vite as the foreground process while Air Jam manages the local server in the background.
1. Do not replace the Air Jam dev flow with raw `pnpm exec vite` unless you intentionally want frontend-only rendering without the local Air Jam backend.
1. If you need HTTPS/secure local dev, use `pnpm run dev -- --secure`.
1. If local runtime state feels stale, use Air Jam status/log/reset tooling before debugging gameplay code.
1. After editing host-only runtime refs, physics loops, or `useHostActionListener` side effects, hard refresh the host or run `pnpm exec airjam reset local` if actions appear duplicated or rendered state no longer matches replicated state.

## Canonical Files

`src/airjam.config.ts`
: Exports `airjam = defineAirJamGame(...)` from `@air-jam/sdk/core`: metadata, stores, simulation, input, bindings, controller path, agent and testing path. The entire graph stays free of React, the SDK root, TSX and CSS.

`src/app.tsx`
: Binds the declaration with `createAirJamApp(airjam, { runtime })` and mounts its Host and Controller.

`src/game/contracts/agent.ts`
: Owns the semantic agent contract. Keep snapshot projection and semantic actions here.

## Action Rules

1. `player:*` actions act like a player or a semantic controller verb.
2. `host:*` actions are deterministic semantic host actions. Define them with `agentAction.host(...)` when the game needs precise host staging or reset verbs for testing, visual proof, or controlled setup.
3. Store action dispatch returns an acknowledgement. Check it when outcome matters.
4. For `airjam.invoke_game_session_action`, prefer the returned normalized `outcome` over guessing from the raw acknowledgement alone. A missing host acknowledgement with observed committed state change is still a meaningful success signal, not an automatic rejection.
5. `ctx.actorId` always means the dispatcher. If host code dispatches with `gameStore.actions`, then `ctx.actorId` is the host.
6. If host code intentionally needs to run the same semantic player action as controller `X`, use `gameStore.asPlayer("X")` explicitly.
7. If a store action needs a host-only local side effect like audio, sim refs, or one-shot UI effects, use `useHostActionListener(gameStore, ...)` instead of replicated queue-and-drain state.
8. `resultDescription` is documentation for agents and humans about the expected semantic effect. It does not automatically become runtime result data.
9. If an action must return actual runtime result data, return `acceptAirJamAction(result)` from the store action and read the acknowledgement/result separately.
10. Put per-step gameplay in a declared simulation (`defineAirJamSimulation`, declared with `defineAirJamGame({ simulation })`): step it with game time and `random` from its context, declare what agents see with `observe`, and draw it with `useSimulationFrame`. Never hand-roll `requestAnimationFrame` or `setInterval` gameplay loops.
11. Store actions read time as `ctx.now` (game time), never `Date.now()`. Timers and deadlines are checked by the simulation; phones show values the host writes to the store, such as whole seconds left.

## Import Rules

1. Store definitions and simulations import from `@air-jam/sdk/core`, the framework-free runtime; components and hooks import from `@air-jam/sdk`, its React binding. The core imports no React, so the same game logic runs headless.
2. Read live replicated state outside rendering with `gameStore.getState()`.

## Browser + MCP Pairing

1. Browser is the visual truth.
2. Air Jam MCP is the agent-control and runtime-inspection path.
3. Use both together instead of forcing browser automation to do semantic work.
4. In Claude Code or similar preview surfaces, keep host and preview controllers in the same visible preview screen when possible.
5. Add multiple preview controllers from the host preview workspace when you need multiple local players; do not open unrelated OS browser tabs unless the user asks for tabs.
6. Use visible preview controllers for UI smoke proof with real browser click/drag/release gestures.
7. Do not synthesize pointer events into controller iframes from parent-page eval; use semantic game actions when reliable gameplay proof matters.
8. If the agent environment cannot launch a browser, capture the existing room's canonical host and controller views through `airjam.capture_game_session_visuals`; do not start an unrelated browser or room.

## One game declaration

Read `airjam.inspect_game` for the versioned `declaration`, including
`declaration.agent`, controls, controller path and metadata. The game's
`src/airjam.config.ts` exports `airjam = defineAirJamGame(...)` from
`@air-jam/sdk/core`; agent helpers also come from core. Keep React, the SDK
root, TSX and CSS out of its graph. `app.tsx` alone binds it with
`createAirJamApp(airjam, { runtime })`.

Capacity comes from `metadata.maxPlayers`. The `testing` path names a module
exporting `testing = defineAirJamTesting({ player, profiles, visual })` from
`@air-jam/devtools/testing`. Profiles author scripted policies only; a declared
player is offered as the reserved `model` policy in every profile. Optional
`visual.scenarios` uses the game's declared agent. Do not duplicate identity
in template flags or read config source with regular expressions.

## Declared settings

Declare creator tuning values with `defineAirJamSettings` and `setting` from
`@air-jam/sdk/core`, in the game declaration's `settings` field. Remove the
constants they replace. Read values in simulation create/step/observe contexts
and typed action contexts; host rendering uses `useAirJamSettings`. Controllers
show copies in replicated state. Lobby player choices stay store state.

Inspect descriptors in `airjam.inspect_game` → `declaration.settings`.
Use `airjam.read_game_settings({ gameSessionId })` for live values and revision,
then `airjam.update_game_settings({ gameSessionId, patch, expectedRevision })`
under host authority. Only `live: true` values can change; non-live values go
in `airjam.start_game_run({ settings, ... })` for a fresh room. Stale revisions
require a fresh read. Input log version 2 records initial values and ordered
settings updates for replay. See `docs/airjam/generated/settings.md`.

Declared assets and theme are read through `airjam.inspect_game` in
`declaration.assets` and `declaration.theme`. Keep sounds, images and loaded
files in `defineAirJamAssets`, colours and font families in `defineAirJamTheme`,
and pass both to `defineAirJamGame`. The React binding owns audio mounts and
theme CSS variables; games consume the declared objects and never duplicate them.
