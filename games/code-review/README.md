# Code Review

![Air Jam Boxing Arena cover](public/sprites/cover.png)

`code-review` is a fast local-multiplayer boxing game built on the Air Jam host/controller model.
Players join from their phones, pick a team slot, and control fighters inside a shared ring on the host screen.

## What This Game Teaches

- explicit host and controller runtime ownership
- a small Air Jam store with contracts, domain rules, and engine code separated from presentation
- focused host/controller hooks for input, canvas, audio, sprites, and runtime loops
- a simple browser-first party-game loop that is easy to extend
- hosted release bundling through `airjam release bundle`

## Local Development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

To run only this game locally:

```bash
pnpm dev -- --web-only
```

## Scripts

- `pnpm dev` starts the local Air Jam server and Vite app
- `pnpm secure:init` prepares local trusted HTTPS for secure browser APIs
- `pnpm dev -- --secure` runs the game in secure mode
- `pnpm topology --mode=standalone-dev` prints the resolved local runtime topology
- `pnpm exec airjam secure:init --mode=tunnel --hostname my-game-dev.example.com --tunnel my-game-dev` enables the optional tunnel fallback
- `pnpm typecheck` runs the TypeScript project check
- `pnpm test` runs the lightweight domain tests
- `pnpm build` creates the production web build
- `pnpm exec airjam release bundle --dir .` produces the hosted Arcade release zip

## Project Structure

```text
src/
  host/
    components/
    hooks/
    index.tsx
  controller/
    components/
    hooks/
    index.tsx
  game/
    contracts/
    domain/
    engine/
    stores/
    ui/
  airjam.config.ts
  app.tsx
  main.tsx
tests/
  game/
public/
  sounds/
  sprites/
```

## Notes

- Public runtime art and audio live under `public/`.
- `host/` and `controller/` are surface-specific; `game/` is shared by both.
- Source Photoshop/export helper files are intentionally not included in scaffolded projects.
- The scaffolded template keeps the same runtime structure as this source game.
