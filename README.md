<h1 align="center">Air Jam</h1>

<p align="center">
  Open source React framework and creator tools for multiplayer party games with smartphones as controllers.
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
- `@air-jam/cli` for project development, inspection and authoring contracts
- `@air-jam/devtools` for shared authoring, inspection and evaluation tooling

[airjam.io](https://airjam.io) is the separately operated product: hosted games,
Arcade and Studio. Local framework development and self-hosted games do not need
an Air Jam account, product database or provider credentials.

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

The framework package family is:

- `@air-jam/sdk`
- `@air-jam/server`
- `@air-jam/cli`
- `@air-jam/mcp-server`
- `@air-jam/devtools`
- `create-airjam`

The separation checkout contains unpublished 0.9.3 candidates. Qualification of
these local packages is not a claim that the same versions are available on npm.

## Repo Development

```bash
git clone https://github.com/vucinatim/air-jam.git
cd air-jam
pnpm install --frozen-lockfile
pnpm run dev -- --game=pong
```

The normal command starts the public SDK watcher, standalone room server and
selected reference game. It does not start the managed product or a database.
See the [local development guide](./docs/guides/local-development-guide.md)
for ports, phone access and working alongside the private product.

Useful workflows:

```bash
pnpm run repo -- --help
pnpm run status
pnpm logs --view=signal
pnpm check:instant
pnpm check:changed
```

Use `pnpm check:batch` before pushing a substantial change. Pull-request CI
qualifies types, tests, builds, canonical contracts, installed foundation
packages and a bounded performance smoke test. The full release gate remains
`pnpm check:release`.

Fresh installed-package qualification is available as structured evidence:

```bash
pnpm --silent run repo -- pack verify-local --json
```

It builds one exact local package set, installs it into clean consumers, and
checks typed exports, agent helper execution and real standalone room traffic.

## Monorepo Shape

```text
games/              reference games and scaffold sources
packages/
  sdk/              game framework and runtime contracts
  server/           standalone realtime server
  cli/              project CLI, AI pack and development contracts
  mcp-server/       semantic agent tools
  env/              internal environment validation helper
  devtools/         shared authoring, inspection and evaluation tooling
  create-airjam/    game scaffolding
content/docs/       creator documentation source
```

Studio, Arcade, hosted policy, accounts and databases do not live in this
workspace. The private product uses the same framework package exports.

## Documentation

- [Getting Started](https://airjam.io/docs/getting-started/introduction)
- [Architecture](https://airjam.io/docs/how-it-works/architecture)
- [Contributing](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [Docs Index](./docs/docs-index.md)

## Contributing

Issues, discussions, documentation improvements, SDK improvements, reference games, and tooling work are all welcome.

Before opening a PR:

1. run `pnpm check:changed`; use `pnpm check:batch` for a substantial batch
2. keep changes focused
3. update docs when behavior or contracts change

## License

[MIT](./LICENSE)
