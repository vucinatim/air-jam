# Platform Identity And Auth Architecture

Last updated: 2026-05-08  
Status: implemented architecture

Related docs:

1. [../framework-paradigm.md](../framework-paradigm.md)
2. [../contracts/environment-contracts.md](../contracts/environment-contracts.md)
3. [../guides/agent-development-guide.md](../guides/agent-development-guide.md)
4. [../capability-inventory.md](../capability-inventory.md)

## Purpose

This document explains the separate identity and auth planes inside Air Jam.

## Core Position

Air Jam does not have one generic auth story.

It has three distinct auth domains:

1. browser user auth for the platform
2. machine auth for CLI and MCP workflows
3. runtime authority checks for game hosting and socket access

Keeping these separate is an architectural strength, not needless complexity.

## Identity Planes

### Browser User Identity

Owned by the platform app.

Responsibilities:

1. human sign-in
2. account session management
3. dashboard access
4. creator ownership checks

### Machine Identity

Owned by platform machine auth flows.

Responsibilities:

1. CLI login
2. machine session issuance
3. machine access to games, releases, and media APIs

### Runtime Authority Identity

Owned by the realtime runtime and platform/server verification seams.

Responsibilities:

1. host bootstrap verification
2. child-host launch authorization
3. socket authorization policy
4. origin and grant validation

## Boundary Rules

1. A signed-in dashboard user is not the same thing as a runtime host.
2. A machine session is not the same thing as a browser session.
3. Runtime host authority should not depend on browser cookies.
4. Socket authorization should stay explicit and policy-backed.

## Why This Matters

This separation lets Air Jam support:

1. a normal web dashboard
2. machine release automation
3. trusted hosted gameplay authority

without collapsing all three into one brittle auth model.

## Design Rules

1. Keep browser, machine, and runtime auth concepts distinct in both code and
   docs.
2. Keep creator-control APIs on machine or browser identity, not on runtime
   host authority.
3. Keep runtime host verification explicit and provider-independent.
4. Prefer narrow auth surfaces over one giant shared session abstraction.
