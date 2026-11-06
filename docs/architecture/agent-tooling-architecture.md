# Agent And Tooling Architecture

Last updated: 2026-11-06
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
capacity. Agent contracts also come from core. Assets declare sounds, images
and other served public files; the loader rejects missing files with
`AJ_ASSET_MISSING`. The description includes assets and theme. The React
binding owns each surface's audio runtime, filtering sounds by their optional
`surface`, and renders theme colours and fonts as `--airjam-color-*` and
`--airjam-font-*` properties with the surface. Game CSS maps its existing
names to these properties; canvas and 3D drawing read the declared theme.

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

Topology reads do not prepare package builds. Devtools inspects the game once
for its declaration and controller path; the repo topology command selects the
game directory and delegates its environment and surface resolution to the
same CLI runtime resolver used by standalone games. It does not reload the
declaration or start the development stack. Installed workspace dependencies
must already be built, as for other built-package consumers.

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

## Hosted release clients

The public SDK's machine release summary owns the `playUrl` field alongside
host and controller links. CLI inspect/list and MCP inspect/list return the
platform's exact link for both hidden and listed releases.
`archivePlatformRelease` in devtools owns the authenticated archive request;
`airjam release archive` and `airjam.release_archive` are thin adapters over it.
The private platform owns release authorization and lifecycle transitions.

## Hosted catalog media

The CLI's `game media` group uses the existing devtools `platform-game-media`
client for every request. `list` (an alias for `inspect`) reads the owned game's
assets and active selections; `assign` and `archive` operate on an exact asset
ID. Their `--json` output preserves the SDK's validated platform result. The
private platform owns authorization, assignment eligibility and archival; the
CLI adds no media policy or duplicate request transport. The public MCP does
not expose catalog-media tools.

## Creator gameplay analytics

`airjam game analytics overview|sessions --game <slug-or-id>` calls the devtools `platform-game-analytics`
client, using SDK machine schemas for query bounds and JSON responses.
The overview and recent-session endpoints belong to the private platform and
reuse its dashboard analytics services. The public client owns no analytics
queries or calculation policy. No analytics MCP adapter is exposed.
