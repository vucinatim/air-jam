# AI Pack Manifest Contract

Last updated: 2026-05-08  
Status: current contract

Related docs:

1. [../architecture/documentation-and-ai-pack-architecture.md](../architecture/documentation-and-ai-pack-architecture.md)
2. [../architecture/platform-docs-surface-architecture.md](../architecture/platform-docs-surface-architecture.md)
3. [../guides/ai-pack-workflow-guide.md](../guides/ai-pack-workflow-guide.md)

## Purpose

This document defines the manifest contract for the hosted and local AI-pack
system.

## Core Position

The AI pack is a managed guidance bundle.

Its manifests exist to make three things explicit:

1. what pack version is canonical
2. which files are managed by that pack
3. how a local project compares against the hosted canonical pack

## Manifest Layers

### Hosted Root Manifest

Path shape:

1. `/ai-pack/manifest.json`

This manifest owns:

1. schema version
2. available channels
3. latest version per channel
4. pointers to channel and version manifests

### Hosted Channel Manifest

Path shape:

1. `/ai-pack/<channel>/manifest.json`

This manifest owns:

1. the channel name
2. latest pack version
3. channel version history metadata

### Hosted Version Manifest

Path shape:

1. `/ai-pack/<channel>/<version>/manifest.json`

This manifest owns:

1. pack version identity
2. release date
3. file list
4. file kinds
5. file hashes
6. canonical source metadata

### Local Project Manifest

Path shape:

1. `.airjam/ai-pack.json`

This manifest owns:

1. the local project's known pack version
2. the update source URL
3. scaffold metadata
4. source mode information

## Managed File Rule

The version manifest file list is the source of truth for managed AI-pack
files.

That includes things like:

1. local docs
2. generated docs
3. skills
4. top-level guidance files such as `AGENTS.md`

## Update Rule

AI-pack updates are replace-oriented, not merge-oriented.

That means:

1. managed files are compared against the hosted canonical manifest
2. `status` and `diff` expose drift
3. `update` replaces managed files when explicitly requested

The AI pack should not pretend to be a general-purpose merge or sync engine.

## Design Rules

1. Keep manifest URLs explicit and stable.
2. Keep file hashing and file-kind metadata machine-readable.
3. Keep local manifest state separate from hosted version manifests.
4. Treat the manifest contract as the ownership boundary for AI-pack-managed
   files.
