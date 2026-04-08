# The Office

Workplace-chaos party game for one host screen and a room full of phones.

Players join as office workers, move around the floor, complete tasks, take breaks, and try to keep the company running before the whole office spirals into exhaustion and boredom.

## Local Development

Work from the game directory:

```bash
pnpm dev
```

Optional HTTPS setup for device testing:

```bash
pnpm secure:init
pnpm dev -- --secure
```

Optional tunnel fallback:

```bash
pnpm exec airjam secure:init --mode=tunnel --hostname my-game-dev.example.com --tunnel my-game-dev
pnpm dev -- --secure --secure-mode=tunnel
```

## Scripts

- `pnpm dev` starts the local game plus Air Jam server
- `pnpm topology --mode=standalone-dev` prints the resolved local runtime topology
- `pnpm exec air-jam-server logs` reads the canonical unified dev log
- `pnpm typecheck` runs TypeScript without emitting
- `pnpm test` runs the minimal game-store test suite
- `pnpm build` creates the production build
- `pnpm exec airjam release bundle --dir .` creates the hosted release zip for the dashboard

## Project Shape

```text
src/
  airjam.config.ts
  app.tsx
  host/
  controller/
  game/
    stores/
  routes/
  components/
  hooks/
```

The runtime boundary matches the repo reference shape:

- `host/` owns host-only runtime mounting
- `controller/` owns controller-only runtime mounting
- `game/stores/` owns shared match state and actions

## Notes

- Public media assets live under `public/`.
- `matchPhase` is the canonical lifecycle (`lobby | playing | ended`) and `runtimeState` is only the pause/play transport state.
- Use `useHostRuntimeStateBridge(...)` for host runtime-to-lifecycle synchronization.
- Match flow, penalties, and player-state mutation stay host-authoritative.
- This game is scaffoldable through `create-airjam`, so docs and scripts should stay export-safe.
