# Media Presentation Contract

Last updated: 2026-05-08  
Status: current contract

Related docs:

1. [../architecture/hosted-release-pipeline-architecture.md](../architecture/hosted-release-pipeline-architecture.md)
2. [../architecture/platform-control-plane-architecture.md](../architecture/platform-control-plane-architecture.md)
3. [../capability-inventory.md](../capability-inventory.md)

## Purpose

This document defines the contract for game and release presentation media in
Air Jam.

## Core Position

Presentation media and playable release artifacts are separate product assets.

That separation is intentional and should remain true across dashboard, CLI, and
public Arcade surfaces.

## Media Roles

Air Jam media currently covers things like:

1. covers
2. thumbnails
3. preview imagery
4. release screenshots

## Boundary Rules

1. Media objects are managed presentation assets, not playable builds.
2. Release screenshots are evidence or presentation output, not creator-owned
   release zips.
3. Public Arcade rendering should consume normalized media assignment rules.
4. Machine APIs should operate on media nouns explicitly, not as hidden game
   record blobs.

## Design Rules

1. Keep media lifecycle separate from release artifact lifecycle.
2. Keep public URLs stable through platform-owned metadata.
3. Prefer explicit role-based media assignment over one undifferentiated image
   field.
