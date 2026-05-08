# Game Metadata Contract

Last updated: 2026-05-08  
Status: current contract

Related docs:

1. [../contracts/arcade-surface-contract.md](./arcade-surface-contract.md)
2. [../guides/legacy-game-migration-guide.md](../guides/legacy-game-migration-guide.md)
3. [../capability-inventory.md](../capability-inventory.md)

## Purpose

This document defines the stable metadata contract used for catalog and platform
presentation.

## Core Position

Game metadata is not just decorative copy.

It is the typed identity and presentation contract that lets Air Jam keep:

1. the Arcade catalog
2. hosted game records
3. creator-facing settings
4. framework-side metadata parsing

aligned on the same project identity.

## Canonical Fields

The contract should cover:

1. stable slug
2. display name
3. tagline
4. category
5. min and max players
6. input modality
7. supported SDK range
8. maintainer metadata
9. age rating
10. tags

## Boundary Rules

1. Metadata defines presentation identity, not live gameplay state.
2. Metadata should be typed and parseable from framework-side authoring.
3. Hosted platform records may enrich metadata, but should not invent a second
   incompatible identity model.
4. Public catalog surfaces should consume normalized metadata, not ad hoc view
   props.

## Design Rules

1. Keep metadata schema stable and machine-readable.
2. Treat slug as durable identity, not disposable copy.
3. Keep presentation metadata separate from release artifacts and analytics.
