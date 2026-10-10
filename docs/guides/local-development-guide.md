# Local Development Guide

Last updated: 2026-10-09

Status: current guide

Related docs:

1. [../framework-paradigm.md](../framework-paradigm.md)
2. [../contracts/runtime-topology-contract.md](../contracts/runtime-topology-contract.md)
3. [../architecture/agent-tooling-architecture.md](../architecture/agent-tooling-architecture.md)
4. [../working-agreements.md](../working-agreements.md)

## Purpose

This guide explains the intended local development and validation loop for Air
Jam projects and maintainers.

## Canonical Front Door

For normal public-framework development, use:

```bash
pnpm run dev
```

This starts the SDK watcher, standalone room server and selected reference game.
It does not start the private Arcade/Studio application or require a product
account, product database or cloud credentials. Select another reference game
with `pnpm run dev -- --game=pong`; inspect available games with
`pnpm run dev -- --help`.

The default game and server ports are 5173 and 4000. When another development
session owns them, choose unused ports rather than stopping that session:

```bash
AIR_JAM_SERVER_PORT=4311 VITE_PORT=4310 pnpm run dev -- --game=pong
```

Startup checks the requested ports and fails without killing their owners.
Stopping this command shuts down only its own child processes. The SDK's first
successful build must complete before the game starts.

Do not treat preview-only flows or raw lower-level commands as the normal
starting point unless the task explicitly needs them.

## What The Normal Loop Looks Like

1. run `pnpm run dev`
2. open the host preview
3. use visible preview controllers for UI smoke proof
4. use semantic session tooling for reliable gameplay proof
5. inspect logs or topology when behavior is unclear
6. reset local state when the runtime gets weird

## First Commands To Reach For

```bash
pnpm run dev
pnpm run status
pnpm run reset:local
pnpm run repo -- workspace logs --view=signal
pnpm run repo -- workspace topology --game pong --mode standalone-dev
```

## Preferred Proof Split

### Browser Proof

Use the browser for:

1. visible controller and host UI checks
2. click-through validation
3. layout and rendering proof

### Semantic Proof

Use semantic session tooling for:

1. gameplay assertions
2. repeated match flow validation
3. reliable state checks
4. deterministic action invocation

## When To Inspect Topology

Use topology inspection when:

1. a host or controller URL looks wrong
2. a local mode is resolving the wrong backend
3. private Arcade and public standalone assumptions diverge
4. preview or hosted behavior feels mixed with local behavior

## Debugging Rule

When behavior is unclear, inspect the unified log stream before adding random
temporary logging.

The preferred first read is:

```bash
pnpm run repo -- workspace logs --view=signal
```

## Product and Framework Development

The private product owns Arcade, Studio, its database and hosted service
composition. Product-only work uses its pinned public packages and its own
`pnpm run dev`; public contributors do not need that checkout.

For changes spanning both repositories, the private product's
[local development guide](https://github.com/vucinatim/air-jam-platform/blob/main/docs/guides/local-development-guide.md)
owns its source-attachment commands and contract. Release qualification still
requires clean installed packages, not an attached developer checkout.

## Standalone Server Image

The public server image contains the server's production dependency closure,
not the product application, database adapters or complete workspace.

```bash
docker build -f packages/server/Dockerfile -t airjam-server .
docker run --rm -p 127.0.0.1:4000:4000 -e AIR_JAM_AUTH_MODE=disabled airjam-server
```

This example explicitly allows unauthenticated local sessions and binds only to
localhost. Do not expose it as the managed Air Jam service. Production defaults
require authentication and reject startup without an explicit authentication
adapter. Authenticated self-hosting uses the server's typed library entrypoint;
the private product supplies its own hosted adapters to that same runtime.

The image exposes `/health` and `/ready` and drains on SIGTERM. Qualify deployment
architecture and authentication separately before changing any service source.
