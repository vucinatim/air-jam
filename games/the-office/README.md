# The Office

Workplace-chaos party game for one host screen and a room full of phones.

Players join as office workers, move around the floor, complete tasks, take breaks, and try to keep the company running before the whole office spirals into exhaustion and boredom.

## Local Development

From the monorepo root, run the shared workspace stack with this game active:

```bash
pnpm dev -- --game=the-office
```

That starts:

- the Air Jam SDK watcher
- the local Air Jam server
- the platform app on `http://localhost:3000`
- this game on `http://localhost:5173`

If you want to work from the game directory only:

```bash
pnpm dev
```

Optional HTTPS setup for device testing:

```bash
pnpm secure:init -- --hostname my-game-dev.example.com --tunnel my-game-dev
pnpm dev -- --secure
```

## Scripts

- `pnpm dev` starts the local game plus Air Jam server
- `pnpm dev:server` starts only the local Air Jam server
- `pnpm logs` reads the canonical unified dev log
- `pnpm typecheck` runs TypeScript without emitting
- `pnpm test` runs the minimal game-store test suite
- `pnpm build` creates the production build
- `pnpm release:bundle` creates the hosted release zip for the dashboard

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
- Match flow, penalties, and player-state mutation stay host-authoritative.
- This game is scaffoldable through `create-airjam`, so docs and scripts should stay export-safe.
