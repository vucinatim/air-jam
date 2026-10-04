# Agent Session Contract

Last updated: 2026-09-12
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
host. Explicit attachments retain player inputs, player semantic actions,
state inspection, and ordinary cooperative game controls. They must not invoke
an action under a fabricated host identity. Session action discovery reports
`host_runtime_not_owned` for host-only actions when no owning runtime exists.

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
