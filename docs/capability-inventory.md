# Air Jam Framework Capability Inventory

Last updated: 2026-10-09
Status: implemented public reference

This inventory describes the public separation checkout, not unpublished
roadmap features or the private product's implementation.

## Runtime and server

The SDK and standalone room server provide rooms, room-assigned seats held by
each device's key across reloads and dropped networks, typed input, a gate for
opening rooms, per-room limits, channels the room keeps a copy of, requests
and host-to-controller signals. Embedded game and controller frames get a
scoped view of their parent's room session. The host remains the authority
for gameplay state.

The three runtime lanes are transient input, host-owned replicated state and
explicit signals/commands. Core authoring APIs include `createAirJamApp`,
`airjam.Host`, `airjam.Controller`, `createAirJamStore`,
`defineAirJamSimulation`, `defineAirJamInput` and the phone controls
`ControlButton`, `AxisButton` and `Stick`.

The server also exposes `createRoomServer` with a gate seam, so a hosted
service decides who opens rooms without its persistence entering the
standalone runtime.
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

`content/docs/` and its catalog own the 17 creator pages. The CLI ships verified
MDX and agent-guidance snapshots; `airjam docs list/read --json` and
`@air-jam/cli/documentation` expose the website snapshot. The private website
supplies its renderer and presentation components without owning a prose copy.

Public release clients validate and bundle games, authenticate with supported
machine APIs, and submit, publish or inspect hosted releases. Managed artifact
processing, storage, moderation and operational workers belong to the private
product.

## Package and verification surfaces

The coordinated foundation contains `@air-jam/sdk`, `@air-jam/server`,
`@air-jam/cli`, `@air-jam/mcp-server`, `@air-jam/devtools` and `create-airjam`.
Devtools owns the evaluation harness and shared CLI/MCP implementation.
Environment validation remains an internal build helper.

Fast changed checks, full batch gates, package archive proofs, server integration
tests, scaffold smoke and the six-cell installation matrix cover different
boundaries. Local archive qualification does not prove npm publication,
physical-device compatibility or production rollout.
