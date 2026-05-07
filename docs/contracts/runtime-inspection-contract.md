# Runtime Inspection Contract

Last updated: 2026-05-08  
Status: current contract

Related docs:

1. [../contracts/agent-session-contract.md](./agent-session-contract.md)
2. [../architecture/agent-tooling-architecture.md](../architecture/agent-tooling-architecture.md)
3. [../capability-inventory.md](../capability-inventory.md)

## Purpose

This document defines the contract for publishing and reading runtime inspection
state in Air Jam.

## Core Position

Runtime inspection is a first-class contract, not a debugging accident.

It exists so tools and agents can read authoritative runtime facts without
scraping arbitrary UI state.

## Contract Responsibilities

The runtime inspection contract should make these things readable:

1. room identity and state
2. player identity and connection state
3. host runtime state
4. controller runtime state
5. action metadata exposed by the runtime

## Boundary Rule

Runtime inspection is for reading and understanding runtime state.

It is not the same thing as:

1. semantic session control
2. platform release operations
3. low-level socket inspection

## Publication Rule

Host and controller runtimes should publish explicit inspection contracts rather
than expecting tools to infer state from component trees or debug globals.

## Design Rules

1. Keep inspection state typed and explicit.
2. Prefer semantic runtime facts over transport internals.
3. Keep reading surfaces machine-friendly and stable.
4. Do not collapse inspection and control into one muddy abstraction.
