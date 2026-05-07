# Documentation And AI Pack Architecture

Last updated: 2026-05-08  
Status: implemented architecture

Related docs:

1. [../vision.md](../vision.md)
2. [../framework-paradigm.md](../framework-paradigm.md)
3. [../guides/agent-development-guide.md](../guides/agent-development-guide.md)
4. [../capability-inventory.md](../capability-inventory.md)

## Purpose

This document explains Air Jam documentation as a product surface for both
humans and agents.

## Core Position

Air Jam docs are not just markdown pages.

They are a delivery system with multiple outputs:

1. repo-native reference docs
2. public hosted docs
3. generated AI pack content
4. machine-readable docs discovery surfaces

## Main Layers

### Repo Reference Layer

This repo layer owns:

1. current-state and operating docs
2. architecture, contracts, and guides
3. strategy and vision material
4. archive and execution history

### Public Docs Layer

This layer owns:

1. hosted documentation pages
2. discoverable public explanations
3. human-facing learning surfaces

### AI Pack Layer

This layer owns:

1. generated docs packs
2. `llms.txt`
3. docs manifest and search index surfaces
4. generated project-facing agent docs

## Why This Matters

Air Jam is trying to support:

1. framework users
2. hosted platform creators
3. maintainers
4. agents

Those audiences overlap, but they do not consume documentation the same way.

## Design Rules

1. Keep repo docs as the canonical authored source.
2. Treat public docs and AI pack outputs as delivery formats, not independent
   knowledge silos.
3. Keep machine-oriented docs explicit instead of assuming browser scraping.
4. Prefer one stable concept explained well over duplicating the same idea
   across many weak pages.
