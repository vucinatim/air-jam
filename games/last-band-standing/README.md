# Last Band Standing

Music-first party game for a shared host screen and a room full of phones.

Players join on their controllers, ready up, and race through timed music rounds where they identify songs and artists. The host drives the match flow, reveals answers, and keeps the shared scoreboard in sync.

## Local Development

Work from the game directory:

```bash
pnpm dev
```

Optional HTTPS setup for mobile sensor/device testing:

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
- `pnpm test` runs Vitest once
- `pnpm build` creates the production build
- `pnpm songs:validate` checks every `youtubeUrl` in `src/game/content/song-bank.ts` and writes a curation report
- `pnpm exec airjam release bundle --dir .` creates the hosted release zip for the dashboard

## Project Shape

```text
src/
  airjam.config.ts
  app.tsx
  host/
  controller/
  game/
    content/
    contracts/
    domain/
    stores/
    ui/
  routes/
tests/
  game/
    content/
    domain/
```

The app boundary follows the same ownership model as the repo reference games:

- `host/` mounts host-only runtime ownership
- `controller/` mounts controller-only runtime ownership
- `game/contracts/` holds SDK-facing input and audio contracts
- `game/content/` holds curated song data
- `game/domain/` holds pure match logic
- `game/stores/` holds state ownership and helpers
- `game/ui/` holds shared game-specific presentation pieces

## Notes

- The `/youtube-test` route is debug-only (`import.meta.env.DEV` or `VITE_ENABLE_YOUTUBE_TEST_ROUTE=true`).
- Match timing, reveal flow, and scoring stay host-authoritative.
- The shell contract is standard: internal phases map through `src/game/domain/match-phase.ts` to `lobby | playing | ended`, and runtime pause/play is owned separately by explicit pause/resume commands.
- This game is scaffoldable through `create-airjam`, so keep docs and scripts export-safe.

## Song Curation Workflow

1. Run `pnpm songs:validate`.
2. Review `reports/song-embed-report.json`.
3. Remove or replace entries in `src/game/content/song-bank.ts` where `embeddable` is `false` or `duplicateId` is `true`.
4. Re-run validation until only embeddable, unique IDs remain.
