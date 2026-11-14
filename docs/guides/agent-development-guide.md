# Agent Development Guide

Last updated: 2026-10-09

Status: current guide

Related docs:

1. [../architecture/agent-tooling-architecture.md](../architecture/agent-tooling-architecture.md)
2. [../contracts/agent-session-contract.md](../contracts/agent-session-contract.md)
3. [../contracts/runtime-inspection-contract.md](../contracts/runtime-inspection-contract.md)
4. [../guides/local-development-guide.md](../guides/local-development-guide.md)

## Purpose

This guide explains the intended development loop for agents working on Air Jam
games and tooling.

## Core Rule

Prefer semantic control surfaces before browser-only automation.

The normal order is:

1. start the normal dev loop
2. use semantic session operations for gameplay truth
3. use runtime inspection for readable state
4. use logs and topology when debugging
5. use the browser for visible proof

## Canonical Loop

1. run `pnpm run dev`
2. inspect the relevant game or project contract
3. open a semantic game session
4. send input or invoke actions
5. read session and runtime state
6. close the session
7. use browser checks for visible UI confidence

## When To Prefer Semantic Sessions

Use semantic session control for:

1. score assertions
2. match flow testing
3. repeated setup and teardown
4. deterministic action invocation

## When To Prefer Browser Checks

Use the browser for:

1. controller and host layout proof
2. visual regressions
3. public-surface trust checks
4. click-through and presentation verification

## Capture Against an Existing Runtime

`captureVisualsAtRuntime` from `@air-jam/devtools/visual` runs the same
game-owned scenarios as `captureVisuals`, without starting, attaching to or
stopping the caller's runtime. Supply the game project `cwd`, its optional
source `gameId`, resolved runtime `urls`, `mode` (`standalone-dev` or
`arcade-built`) and an absolute `artifactRoot`. The source game id identifies
the project, not a launcher catalog alias. The result contains the capture
summary and scenario metadata at the caller's artifact root.

The game's declaration must name a `testing` module exporting
`testing = defineAirJamTesting({ profiles, visual: { scenarios } })`. Visual
scenarios use the declaration's agent contract; arbitrary files are not
discovered as a fallback. The runtime owner remains responsible
for startup, readiness and shutdown on success or failure. Normal standalone
agents should continue using `captureVisuals` when they want the tool to manage
that lifecycle.

## Isolated prefab inspection

Declare the game's `prefabs` catalog on `defineAirJamGame` and pass `prefabStage={Stage}`
to `app.Host`. Open the host URL with `airjamInspect=1`; optional `prefab`, `state`
and `time` parameters select an initial paused frame. This document starts no room,
server connection or simulation. It is supported in production builds too.

Embed the document with the same explicit parent origin/topology used by host previews.
Use `createPrefabInspectionClient` from `@air-jam/sdk/prefab-inspection` with the frame's
window and origin. Call `read()` after binding or loading the frame, handle ready,
unavailable and error messages, then `select(selection)` and `capture(views)`.
A capture takes up to eight `{ stateId, time, view }` entries for the selected prefab,
waits two render frames for each and restores the previous selection, including playback.
It returns canvas JPEG data URLs and dimensions. Dispose the client when replacing the frame.
The same validated protocol serves agents and Studio; no separate capture catalog or URL
builder is needed. Do not import creator modules in a trusted parent process.

## Design Rule

If an agent workflow is forced to rely mainly on DOM event synthesis instead of
semantic session tooling and inspection contracts, that is usually a sign that
the Air Jam control surface should be improved.
