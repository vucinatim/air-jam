# Claude Workflow Notes

Use the same Air Jam development path as every other agent.

## Local Launch

Start local development with:

```bash
pnpm run dev
```

Do not use raw `vite` for normal Air Jam work. It skips the local Air Jam server.

Do not create or prefer a separate preview-specific dev command. If local runtime state looks stale, use Air Jam status/log/reset tooling before debugging gameplay code:

```bash
pnpm run status
pnpm run reset:local
pnpm exec air-jam-server logs --view=signal
```

After editing host-only runtime refs, physics loops, or `useHostActionListener` side effects, hard refresh the host or run `pnpm run reset:local` if actions appear duplicated or rendered state no longer matches replicated state.

## Preview Controllers

Use visible preview controllers for UI smoke proof:

1. click buttons with real browser clicks
2. drag controls with real browser drag/release gestures
3. verify that the controller visually connects and can trigger at least one visible action

Do not synthesize pointer events into controller iframes from parent-page eval. That path is brittle around iframe boundaries, pointer capture, and React event timing.

## Gameplay Proof

Use the game-owned agent contract for reliable gameplay assertions:

1. `airjam.open_game_session`
2. `airjam.read_game_session`
3. `airjam.invoke_game_session_action`
4. `airjam.close_game_session`

Use semantic actions for gameplay mechanics, physics outcomes, scoring, reset, and state assertions. Preview controllers are for visible UI smoke proof, not the primary automation lane.

## Game Authoring Rule

Multiplayer games should be controllable from controllers. If a game has a start, ready, reset, or similar primary flow, expose it through controller UI and semantic agent actions. The host screen should not be the only place where play begins.
