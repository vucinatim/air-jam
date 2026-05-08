# Agent And Tooling Architecture

Last updated: 2026-05-08  
Status: implemented architecture

Related docs:

1. [../vision.md](../vision.md)
2. [../framework-paradigm.md](../framework-paradigm.md)
3. [../capability-inventory.md](../capability-inventory.md)
4. [../contracts/agent-session-contract.md](../contracts/agent-session-contract.md)
5. [../guides/local-development-guide.md](../guides/local-development-guide.md)

## Purpose

This document explains how Air Jam exposes machine-usable control surfaces for
agents and development tools.

## Core Position

Air Jam does not treat agents as browser-only automation clients.

The intended architecture is:

1. semantic game session control first
2. runtime inspection as an explicit contract
3. logs and topology as explicit tooling surfaces
4. browser interaction as proof and fallback, not the only lane

## Layers

### 1. Repo And Dev Loop Tooling

This layer owns:

1. dev stack start and stop
2. topology inspection
3. local reset
4. unified log reading
5. quality gate execution

This is the machine-operable workspace layer.

### 2. Semantic Game Session Tooling

This layer owns:

1. opening a game session
2. sending controller input semantically
3. reading session state
4. invoking game or host actions
5. closing sessions

This is the preferred machine-control surface for gameplay truth.

### 3. Runtime Inspection Contracts

This layer owns:

1. host contract publication
2. controller contract publication
3. room and player inspection
4. action metadata exposure

This keeps important runtime facts machine-readable without turning everything
into ad hoc UI scraping.

### 4. Release And Hosted Operations

This layer owns:

1. release doctor/validate/bundle
2. submit/publish/inspect flows
3. hosted release and media machine actions

This is how Air Jam’s machine story extends beyond local gameplay into hosted
product operations.

## Why This Matters

The agent/tooling architecture is one of the strongest parts of the Air Jam
ecosystem because it links:

1. local authoring
2. deterministic runtime control
3. hosted release operations
4. future AI-native Studio direction

That combination is much bigger than "a game framework with some MCP tools."

## Design Rules

1. Prefer semantic control surfaces over DOM-only control.
2. Keep runtime inspection explicit and typed.
3. Keep logs and topology first-class machine surfaces.
4. Use browser surfaces for visual proof and user-facing validation, not as the
   only source of truth.
5. Keep hosted release operations on the same nouns as the platform control
   plane.
