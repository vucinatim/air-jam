# Agent And Tooling Architecture

Last updated: 2026-10-30
Status: implemented architecture

Related docs:

1. [../vision.md](../vision.md)
2. [../framework-paradigm.md](../framework-paradigm.md)
3. [../capability-inventory.md](../capability-inventory.md)
4. [../contracts/agent-session-contract.md](../contracts/agent-session-contract.md)
5. [../guides/local-development-guide.md](../guides/local-development-guide.md)

## Purpose

This document explains how Air Jam exposes machine-usable control surfaces for
agents and development tools.

## Core Position

Air Jam does not treat agents as browser-only automation clients.

The intended architecture is:

1. semantic game session control first
2. runtime inspection as an explicit contract
3. logs and topology as explicit tooling surfaces
4. browser interaction as proof and fallback, not the only lane

## Game declarations

`src/airjam.config.ts` exports one branded `defineAirJamGame` declaration from
`@air-jam/sdk/core`. Its graph is framework-free; React binds it in `app.tsx`
with `createAirJamApp(game, { runtime })`. Metadata owns identity and room
capacity. Agent contracts also come from core.

Devtools' `load-game.ts` serializes declaration imports. One synchronous Node
resolve hook rejects framework imports throughout each declaration load,
regardless of parent URL, and becomes inactive when the import settles. Tools
await the declaration before loading testing or starting framework-bound work.
Its `describe-game` subprocess
returns versioned JSON validated in core; `listGames` uses one process for the
workspace, and `inspectGame` describes one game. CLI, MCP, release, scaffold and
repo tooling consume those services. `airjam.inspect_game` exposes the
`declaration`, including the agent contract and controls.

Development profiles, the player and optional visual scenarios live in the
module named by `testing`, exported through `defineAirJamTesting`. A declared
player supplies the reserved `model` policy to every profile; visual scenarios
use the game's agent. These modules stay out of browser bundles.

## Layers

### 1. Repo And Dev Loop Tooling

This layer owns:

1. dev stack start and stop
2. topology inspection
3. local reset
4. unified log reading
5. quality gate execution

This is the machine-operable workspace layer.

### 2. Semantic Game Session Tooling

This layer owns:

1. opening a game session
2. sending controller input semantically
3. reading session state
4. invoking game or host actions
5. closing sessions

This is the preferred machine-control surface for gameplay truth. The session
owns a bounded operation queue and the existing private channel to its browser
host. The SDK evaluates the already-loaded contract in that game's realm and
reads the authoritative store registry. Player writes use real controller
transport; host writes use normal owned local dispatch. Contract and runtime
instance identities prevent comparing state across hot replacement. There is no
Node-side live-contract cache or per-action TypeScript helper.

Explicit room attachments remain participant transport, with raw input/state;
semantic testing requires a separately owned host. Static source inspection is
separately labeled and never supplies a running session's semantics. See the
[session contract](../contracts/agent-session-contract.md) for the unreleased
export/option removals and failure semantics.

### 3. Runtime Inspection Contracts

This layer owns:

1. host contract publication
2. controller contract publication
3. room and player inspection
4. action metadata exposure

This keeps important runtime facts machine-readable without turning everything
into ad hoc UI scraping.

### 4. Release And Hosted Operations

This layer owns:

1. release doctor/validate/bundle
2. submit/publish/inspect flows
3. hosted release and media machine actions

This is how Air Jam’s machine story extends beyond local gameplay into hosted
product operations.

Public tools own the supported clients and portable release validation. The
private product owns account admission, persistence, processing and provider
operations. Local authoring does not require those hosted services.

## Why This Matters

The agent/tooling architecture is one of the strongest parts of the Air Jam
ecosystem because it links:

1. local authoring
2. deterministic runtime control
3. hosted release operations
4. the free external-agent development-harness direction

That combination is much bigger than "a game framework with some MCP tools."

## Design Rules

1. Prefer semantic control surfaces over DOM-only control.
2. Keep runtime inspection explicit and typed.
3. Keep logs and topology first-class machine surfaces.
4. Use browser surfaces for visual proof and user-facing validation, not as the
   only source of truth.
5. Keep hosted release operations on the same nouns as the platform control
   plane.
