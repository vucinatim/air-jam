# Agent Development Guide

Last updated: 2026-05-08  
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

## Design Rule

If an agent workflow is forced to rely mainly on DOM event synthesis instead of
semantic session tooling and inspection contracts, that is usually a sign that
the Air Jam control surface should be improved.
