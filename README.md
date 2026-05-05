<p align="center">
  <img src="./apps/platform/public/images/airjam-logo.png" alt="Air Jam" width="160" />
</p>

<h1 align="center">Air Jam</h1>

<p align="center">
  Open source React framework and platform for multiplayer party games with smartphones as controllers.
</p>

<p align="center">
  <a href="https://github.com/vucinatim/air-jam/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/vucinatim/air-jam/ci.yml?branch=main&label=ci" alt="CI status" />
  </a>
  <a href="https://www.npmjs.com/package/create-airjam">
    <img src="https://img.shields.io/npm/v/create-airjam?label=create-airjam" alt="create-airjam npm version" />
  </a>
  <a href="https://airjam.io">
    <img src="https://img.shields.io/badge/site-airjam.io-00d3f3" alt="airjam.io" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/github/license/vucinatim/air-jam" alt="MIT License" />
  </a>
</p>

<p align="center">
  <a href="https://airjam.io">Website</a>
  ·
  <a href="https://airjam.io/docs/getting-started/introduction">Docs</a>
  ·
  <a href="https://github.com/vucinatim/air-jam/discussions">Discussions</a>
  ·
  <a href="https://github.com/vucinatim/air-jam/issues">Issues</a>
</p>

## What Air Jam Is

Air Jam lets you build multiplayer games where:

- the host runs on a laptop, desktop, or TV
- players join instantly by scanning a QR code
- smartphones become game controllers in the browser
- you ship without native mobile apps or app-store installs

It is designed for party games, couch multiplayer, installations, classroom games, playtesting, and AI-assisted game iteration.

## What You Get

- `@air-jam/sdk` for controller input, replicated state, runtime helpers, and host/controller contracts
- `@air-jam/server` for real-time multiplayer session handling
- `@air-jam/mcp-server` for agent and tooling integration
- `create-airjam` for scaffolding new games from production templates
- `airjam.io` for docs, hosted games, and the Arcade catalog

## Create A Game

```bash
npx create-airjam@latest my-game
cd my-game
pnpm install
pnpm run dev
```

Choose a template explicitly if you want a stronger starting point:

```bash
npx create-airjam@latest my-game --template pong
npx create-airjam@latest my-game --template air-capture
```

Then open the host locally, scan the QR code with your phone, and start playing.

## Why Air Jam

- No controller app download
- Real-time multiplayer built for room-scale play
- Strong host/controller contracts instead of ad hoc browser glue
- React + TypeScript + Zod end to end
- First-party reference games you can actually learn from
- A path toward AI-native game creation, testing, and publishing workflows

## Public Packages

Air Jam’s supported public npm surface is intentionally small:

- [`@air-jam/sdk`](https://www.npmjs.com/package/@air-jam/sdk)
- [`@air-jam/server`](https://www.npmjs.com/package/@air-jam/server)
- [`@air-jam/mcp-server`](https://www.npmjs.com/package/@air-jam/mcp-server)
- [`create-airjam`](https://www.npmjs.com/package/create-airjam)

Everything else in the monorepo should be treated as internal implementation detail.

## Repo Development

If you want to work on Air Jam itself:

```bash
git clone https://github.com/vucinatim/air-jam.git
cd air-jam
pnpm install
```

Useful top-level workflows:

```bash
pnpm arcade:dev --game=air-capture
pnpm standalone:dev --game=pong
pnpm arcade:test --game=code-review
pnpm logs --view=signal
```

For the normal quality gate:

```bash
pnpm check:ci
```

For the full local release gate:

```bash
pnpm check:release
```

## Monorepo Shape

```text
apps/
  platform/        airjam.io platform, docs, dashboard, Arcade
games/
  ...              first-party games and scaffold sources
packages/
  sdk/             public game framework
  server/          public realtime server
  mcp-server/      public MCP surface
  create-airjam/   public scaffolding CLI
```

## Documentation

- [Getting Started](https://airjam.io/docs/getting-started/introduction)
- [Architecture](https://airjam.io/docs/how-it-works/architecture)
- [Contributing](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [Docs Index](./docs/docs-index.md)

## Contributing

Issues, discussions, documentation improvements, SDK improvements, reference games, and tooling work are all welcome.

Before opening a PR:

1. run `pnpm check:ci`
2. keep changes focused
3. update docs when behavior or contracts change

## License

[MIT](./LICENSE)
