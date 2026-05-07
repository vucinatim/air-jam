# Agent Session Contract

Last updated: 2026-05-08  
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
