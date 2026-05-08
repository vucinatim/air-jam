# Platform Control Plane Architecture

Last updated: 2026-05-08  
Status: implemented architecture

Related docs:

1. [../framework-paradigm.md](../framework-paradigm.md)
2. [../strategy/public-arcade-release-strategy.md](../strategy/public-arcade-release-strategy.md)
3. [../strategy/deployment-and-monetization-strategy.md](../strategy/deployment-and-monetization-strategy.md)
4. [../contracts/environment-contracts.md](../contracts/environment-contracts.md)
5. [../capability-inventory.md](../capability-inventory.md)

## Purpose

This document explains the first-party Air Jam platform as a control plane, not
just as a website.

Its job is to make the platform layer legible as the hosted authority around the
open framework.

## Core Position

The platform is the hosted authority plane for:

1. account identity
2. game records
3. release records
4. managed media
5. hosted release artifacts
6. analytics products
7. machine workflows for CLI and MCP consumers

It is not:

1. the realtime gameplay runtime
2. the long-lived browser worker
3. the framework itself

## Main Responsibilities

### 1. Public Product Surface

The platform owns:

1. the landing page
2. docs delivery
3. the public Arcade browser
4. public hosted release pages

This is the human-facing discovery and usage surface.

### 2. Creator Control Surface

The platform owns:

1. account management
2. dashboard game management
3. release management
4. managed media assignment
5. analytics presentation

This is the creator-facing control surface around the hosted product.

### 3. Hosted Authority Plane

The platform owns:

1. game identity records
2. release lifecycle authority
3. machine authentication for CLI and MCP release flows
4. moderation and screenshot orchestration entrypoints
5. public visibility and release-state transitions

This is what turns Air Jam from "an SDK plus some pages" into a real hosted
product.

## Canonical Data Model

The platform should be understood through a small number of nouns.

### Account

Represents the authenticated human or machine operator.

The account layer owns:

1. sign-in
2. dashboard access
3. machine session issuance

### Game

Represents the durable creator-owned identity for a project inside Air Jam.

A game owns:

1. slug
2. display metadata
3. media assignment
4. release collection
5. analytics grouping

### Release

Represents a versioned hosted distribution candidate or public build.

A release owns:

1. artifact identity
2. release state
3. screenshot/moderation results
4. public hosted serving eligibility

### Media Asset

Represents managed presentation media for a game or release.

Media assets are separate from release artifacts so the platform can manage:

1. covers
2. thumbnails
3. preview imagery
4. future richer presentation assets

without pretending they are the same thing as the playable build.

## Runtime Boundaries

The platform coordinates several other boundaries but should not absorb them.

### Realtime Server

Owned by `packages/server`.

Responsibilities:

1. rooms
2. controller routing
3. authoritative gameplay runtime invariants
4. usage event emission

The platform reads and orchestrates around the server. It does not replace it.

### Browser Worker

Owned by `packages/release-browser-worker`.

Responsibilities:

1. screenshot capture runtime
2. browser-based release checks
3. moderation-adjacent browser work

The platform triggers and interprets this work but is not the worker itself.

### Object Storage

Owns:

1. release artifacts
2. managed media objects

The platform owns the metadata and lifecycle around those objects.

## Machine Surfaces

The platform is also the machine-facing product boundary.

It exposes:

1. CLI auth entrypoints
2. machine-authenticated game endpoints
3. machine-authenticated media endpoints
4. machine-authenticated release endpoints

That means the platform is simultaneously:

1. a browser app
2. a creator dashboard
3. a machine control plane

Those are not separate products. They are three views onto the same hosted
authority model.

## Design Rules

1. Keep the realtime gameplay runtime out of the platform app.
2. Keep release/media metadata separate from artifact storage itself.
3. Keep human and machine workflows on the same nouns: account, game, release,
   media.
4. Prefer explicit release state and hosted authority over mutable external URL
   assumptions.
5. Keep the platform as the place where hosted value lives, not where framework
   openness gets restricted.
