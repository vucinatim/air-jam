# Runtime Topology Contract

Last updated: 2026-05-08  
Status: current contract

Related docs:

1. [../framework-paradigm.md](../framework-paradigm.md)
2. [../strategy/deployment-topology.md](../strategy/deployment-topology.md)
3. [../capability-inventory.md](../capability-inventory.md)

## Purpose

This document defines the contract for resolving runtime origins and surface
roles across local, Arcade, hosted, and preview contexts.

## Core Rule

Every Air Jam surface should resolve the same runtime facts from one explicit
topology contract.

No surface should silently guess:

1. app origin
2. backend origin
3. socket origin
4. public host
5. controller base URL
6. surface role

## What The Contract Resolves

The topology contract resolves:

1. runtime mode
2. app origin
3. backend origin
4. socket origin
5. public host
6. host URL
7. controller base URL
8. asset base path
9. proxy strategy
10. surface role

## Supported Modes

The contract currently needs to support:

1. standalone local development
2. live Arcade development
3. built Arcade testing
4. secure local development
5. hosted production and preview deployment contexts

## Ownership Rule

The topology package is the source of truth for:

1. endpoint shape
2. mode interpretation
3. URL resolution rules

SDK, platform, devtools, and machine tooling should consume the contract rather
than re-deriving it independently.

## Failure Rule

If runtime topology cannot be resolved cleanly, startup or tooling should fail
explicitly rather than falling back to hidden heuristics.

The cost of a hard failure is lower than:

1. stale local routes
2. controller URLs that look valid but are wrong
3. mixed preview/prod assumptions
4. platform/runtime disagreement about public hosts
