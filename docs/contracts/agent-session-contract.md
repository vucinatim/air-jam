# Agent Session Contract

Last updated: 2026-10-16
Status: current contract

Related docs:

1. [../vision.md](../vision.md)
2. [../architecture/agent-tooling-architecture.md](../architecture/agent-tooling-architecture.md)
3. [../capability-inventory.md](../capability-inventory.md)

## Purpose

This document defines the preferred machine-control contract for game execution
inside Air Jam.

## Core Position

The canonical agent-control path is semantic game-session control, not raw DOM
automation.

That means tools should prefer:

1. open a game session
2. send semantic controller input
3. read session state
4. invoke host or game actions
5. close the session

## Canonical Operations

The session contract should support:

1. session open
2. session input
3. session read
4. action invoke
5. session close
6. owned host/controller visual capture

## What This Contract Is For

Use it for:

1. gameplay assertions
2. deterministic setup and teardown
3. match flow testing
4. score/state inspection
5. semantic control by agents

## What It Is Not For

Do not treat it as:

1. a replacement for visible browser proof
2. a direct substitute for release/media flows
3. a generic arbitrary runtime shell

Browser surfaces still matter for:

1. visible UI proof
2. layout validation
3. public-surface trust checks

## Boundary Rule

### Player participation and host ownership

A room code or controller join URL grants participation, not ownership of the
host. Explicit attachments retain ordinary player inputs and raw controller
state/action tools. Semantic interpretation requires an owned host; it never
loads local source to interpret another browser's deployment. Session open
reports `semanticAccess: participant-only`, no semantic actions; semantic reads
and invocations reject with `contract_runtime_not_owned`. Omit the explicit room
or join URL to open a separate owned test host. No action uses a fabricated host
identity.

An implicit game session acquires a browser host it actually owns rather than
assuming a discovered local room belongs to it. Host actions travel through
the existing private runtime-owner IPC to that game's browser realm. The SDK's
`@air-jam/sdk/runtime-control` contract exposes a callable
`window[AIR_JAM_RUNTIME_CONTROL_KEY].invoke({ roomId, storeDomain, actionName,
payload })` for live host stores. It calls the normal local action dispatcher,
preserving host context, action listeners, acknowledgements and replication.
It is separate from the JSON inspection snapshot, not a network endpoint,
arbitrary evaluation API, or cross-origin message bridge.

Room/domain ownership and runtime readiness are checked at invocation. Missing,
ambiguous, stale, or unmounted bindings reject. An embedded game can control its
own game store, not the Arcade shell; the harness never substitutes the shell
when its owned game frame is missing. Closing a session disposes only the
runtime that session owns. Attaching to someone else's room never starts,
replaces, or stops their host.

Phone reconnect authority is independent: a server-issued private resume token
proves ownership of the previous player slot. Public controller/device IDs are
hints, not credentials. The token travels only in the private join exchange and
local binding storage, never public presence, game-frame welcome messages,
inspection snapshots, room URLs, or logs. Ordinary room-code joining and
cooperative player controls need no new human approval.

The session contract should stay above the raw transport layer.

Agents should not need to know:

1. socket wire details
2. iframe bridge details
3. room epoch plumbing

They should be able to reason in terms of:

1. session
2. player input
3. host/game action
4. readable state

## Design Rule

If a future tool surface makes agent control depend more on browser event
synthesis than on semantic session operations, that is a regression in the Air
Jam control model.

## Owned visual capture

`captureGameSessionVisuals` / `airjam.capture_game_session_visuals` capture the
owned host and the acting controller's real rendered interface. The controller
view observes the existing transport through `@air-jam/sdk/controller-bridge`;
it has no separate room join or network participant. Its harness context is
bound to the owning controller session, room and controller ID. Only state-sync
reads cross back to that connection; input, profile changes and other mutations
are rejected. Detaching the capture view leaves the controller connected.
The existing Arcade bridge continues to use its active surface identity and epoch.

Captures report immutable project-relative PNG paths and dimensions. Retaining
those files outside the runtime is the consuming tool host's responsibility.
Game source exports do not automatically include runtime capture directories.
Player avatars show accessible initials when artwork cannot load, including in
contained environments with restricted egress; no broader network access is needed.

## Live contract evaluation

The app's Host registers its agent contract while mounted. One SDK evaluator
owns descriptions, input validation/transformation and state projection; static
source inspection uses that same evaluator in a bounded asynchronous helper.
Live sessions never spawn that helper or import authored source into their broker.

The existing realm-local runtime control exposes `agent` read, resolve and
invoke-host operations. Reads use the owning game's authoritative store bindings,
excluding actions and preserving concrete embedded domains. Participant payloads
travel through the normal controller socket. Host semantic resolution and local
dispatch happen together against the expected contract/store identity. This adds
no network endpoint, guest capability or arbitrary evaluation interface.

Each contract registration has an instance ID; document/room/store epochs identify
the live runtime. Requests validate those identities before dispatch. Before and
after observations with different identities report `contract_changed` or
`runtime_replaced`, not a gameplay diff. Contract failures propagate. Registration
cleanup removes only its own binding; ambiguous owners reject.

Session operations are serialized with bounded deadlines. Separate sessions can
run concurrently. Close cancels active channel waits and rejects queued work.
A timed-out operation makes the session unusable until closed; a mutation is never
automatically retried because it may already have executed in the game. The owned
browser/process is disposed by the existing controller lifecycle.

## Unreleased tooling behavior changes

`@air-jam/devtools/agent` now exports only static `inspectGameAgentContract` and
its types. Removed `readGameSnapshot`, `invokeGameAction` and
`resolveGameActionPayload` are replaced by owned `game-session` read/invoke.
Static inspection reports `source: source-declaration` and is not live truth.
The semantic read's `requestSync` option and CLI `session read --no-sync` option
are removed: semantic state always comes directly from the owned host. Raw
controller snapshot synchronization is unchanged. Consumers must use a matching
candidate SDK/devtools pair; no old-source interpretation fallback remains.
These changes are unpublished and require release notes when the package
candidate is eventually promoted.

The in-process visual harness supplies its already-owned game page as the second
library argument to `openGameSession`. It uses the same evaluator and observations,
without launching another host or interpreting source. The harness retains page
lifetime ownership; session close releases its controller. This page reference is
an in-process capability, never an option accepted over CLI, MCP or broker JSON.
