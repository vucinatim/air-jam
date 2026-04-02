# Last Band Standing

Music-first party game for a shared host screen and a room full of phones.

Players join on their controllers, ready up, and race through timed music rounds where they identify songs and artists. The host drives the match flow, reveals answers, and keeps the shared scoreboard in sync.

## Local Development

From this monorepo, run the shared workspace stack with this game active:

```bash
pnpm dev -- --game=last-band-standing
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

Optional HTTPS setup for mobile sensor/device testing:

```bash
pnpm secure:init -- --hostname my-game-dev.example.com --tunnel my-game-dev
pnpm dev -- --secure
```

## Scripts

- `pnpm dev` starts the local game plus Air Jam server
- `pnpm dev:server` starts only the local Air Jam server
- `pnpm logs` reads the canonical unified dev log
- `pnpm typecheck` runs TypeScript without emitting
- `pnpm test:run` runs Vitest once
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
    domain/
    stores/
  features/
  routes/
```

The app boundary follows the same ownership model as the repo reference games:

- `host/` mounts host-only runtime ownership
- `controller/` mounts controller-only runtime ownership
- `game/domain/` holds pure match logic
- `game/stores/` holds state ownership and helpers

## Notes

- The `/youtube-test` route is intentionally kept as a standalone debug surface.
- Match timing, reveal flow, and scoring stay host-authoritative.
- This game is scaffoldable through `create-airjam`, so keep docs and scripts export-safe.
