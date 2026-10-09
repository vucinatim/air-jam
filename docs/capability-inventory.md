# Air Jam Framework Capability Inventory

Last updated: 2026-10-09
Status: implemented public reference

This inventory describes the public separation checkout, not unpublished
roadmap features or the private product's implementation.

## Runtime and server

The SDK and standalone server provide rooms, host/controller roles, typed
input, controller identity and reconnect leases, host authorization, child
launch capability checks, routing and host-to-controller signals. The host
remains the authority for gameplay state.

The three runtime lanes are transient input, host-owned replicated state and
explicit signals/commands. Core authoring APIs include `createAirJamApp`,
`airjam.Host`, `airjam.Controller`, `createAirJamStore`, `useGetInput` and
`useControllerTick`.

The server also exposes its typed composition entrypoint so hosted adapters can
be injected without importing product persistence into the standalone runtime.
See the [composition guide](./guides/server-composition-guide.md).

## Game surfaces

Reusable SDK pieces cover room QR codes, join URLs, connection status, player
identity, lifecycle intents, audio controls, controller inputs and viewport
orientation. Headless hooks support custom presentation.

Audio and music support include sound manifests, playback categories, playlists
and runtime status. Embedded surfaces inherit parent-owned settings and use
capability- and epoch-bound bridges to reject stale runtime messages.

The public embedded protocol supports custom launchers. First-party Arcade UI,
accounts, catalog and controller wrappers are private implementations, not
dependencies of standalone game creation.

## Agent and development tools

The CLI, MCP, harness and reusable devtools expose project/game discovery,
development start/status/stop, topology, structured logs, semantic game
sessions, action invocation, runtime inspection, evaluation and visual capture.

Games declare their semantic actions and stores with the typed agent contract.
The machine path controls gameplay without relying on synthetic pointer events
or opaque browser scraping. Browser interaction remains necessary for visible
controller and presentation proof.

The public repo front door is `pnpm run dev -- --game=<id>`.
Use `pnpm run repo -- --help` for maintainer commands, and CLI/MCP discovery for
the installed project tools. Product database, Railway and release-readiness
operations run in the private repository.

## Scaffolds and reference games

`create-airjam` packages six version-matched templates from public reference
sources. Generated projects include the normal local development path, typed
runtime setup, quality checks and local agent guidance.

The reference catalog includes Pong, Air Capture, Last Band Standing and other
games that exercise input, state, lifecycle, audio, 3D rendering and evaluation.
They are regression and authoring surfaces, not a second framework.

## Documentation and publishing clients

`content/docs/` and its catalog own the 16 creator pages. The CLI ships verified
MDX and agent-guidance snapshots; `airjam docs list/read --json` and
`@air-jam/cli/documentation` expose the website snapshot. The private website
supplies its renderer and presentation components without owning a prose copy.

Public release clients validate and bundle games, authenticate with supported
machine APIs, and submit, publish or inspect hosted releases. Managed artifact
processing, storage, moderation and operational workers belong to the private
product.

## Package and verification surfaces

The coordinated foundation contains `@air-jam/sdk`, `@air-jam/server`,
`@air-jam/cli`, `@air-jam/mcp-server`, `@air-jam/env`, `@air-jam/harness`,
`@air-jam/devtools-core` and `create-airjam`.

Fast changed checks, full batch gates, package archive proofs, server integration
tests, scaffold smoke and the six-cell installation matrix cover different
boundaries. Local archive qualification does not prove npm publication,
physical-device compatibility or production rollout.
