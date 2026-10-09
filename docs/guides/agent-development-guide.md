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

The game's config must explicitly publish `visualScenariosModule`; arbitrary
files are not discovered as a fallback. The runtime owner remains responsible
for startup, readiness and shutdown on success or failure. Normal standalone
agents should continue using `captureVisuals` when they want the tool to manage
that lifecycle.

## Isolated Prefab Capture

The public `@air-jam/devtools/harness/visual` export owns prefab capture. Define
`prefabCaptureHarness` in the game project's `visual/prefabs.ts` or
`visual/prefabs.mjs`, using `definePrefabCaptureHarness`. Add `@air-jam/devtools`
as a development dependency when the game imports that helper. Each definition chooses
its capture id, prefab id, viewport, optional ready test id and host URL builder.
These are trusted game-development modules, not a sandbox for uploaded code.

Call `loadPrefabCapture` with `gameDirectory`, source `gameId`, `prefabId`, optional
repeatable `variantPairs` (`key=value`), `mode` and `secure`. It resolves and checks
the contract before the caller starts a runtime. TypeScript modules require a
TypeScript-capable caller such as `tsx`, as used by the maintainer CLI.
Then pass the returned `capture`, the running `hostUrl` and an absolute
`artifactRoot` to `capturePrefabAtRuntime`. The harness owns its browser and
capture files; the caller owns runtime startup and shutdown. The result contains
the artifact directory, metadata path and metadata. Built Arcade readiness
checks target the embedded game, not the surrounding launcher.

Artifacts live under `<artifactRoot>/<encodedSourceGameId>/prefabs/<capture-and-variants>`.
Source ids are URL-encoded as a single directory segment, so scoped npm project
names retain their identity without becoming nested paths.
Each capture replaces only its own artifact directory. A failed replacement
cannot leave an earlier successful metadata file behind. In this public
workspace, discover the wrapper through `pnpm run repo -- visual prefab-capture --help`.
Other launchers can use the same installed API without this repository.

## Design Rule

If an agent workflow is forced to rely mainly on DOM event synthesis instead of
semantic session tooling and inspection contracts, that is usually a sign that
the Air Jam control surface should be improved.
