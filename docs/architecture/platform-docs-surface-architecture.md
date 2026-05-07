# Platform Docs Surface Architecture

Last updated: 2026-05-08  
Status: implemented architecture

Related docs:

1. [documentation-and-ai-pack-architecture.md](./documentation-and-ai-pack-architecture.md)
2. [platform-control-plane-architecture.md](./platform-control-plane-architecture.md)
3. [../contracts/ai-pack-manifest-contract.md](../contracts/ai-pack-manifest-contract.md)
4. [../guides/ai-pack-workflow-guide.md](../guides/ai-pack-workflow-guide.md)

## Purpose

This document explains the public documentation surface served by the platform
app.

## Core Position

The platform docs surface is not just a few marketing pages.

It is the public delivery plane for:

1. human-facing docs pages
2. machine-readable docs discovery endpoints
3. agent-facing retrieval hints
4. the hosted AI-pack distribution root

## Public Surface

The platform currently serves these public docs-adjacent routes:

1. `/docs`
2. `/docs/[...slug]`
3. `/docs-manifest`
4. `/docs-search-index`
5. `/llms.txt`
6. `/sitemap.xml`
7. `/robots.txt`
8. `/ai-pack/manifest.json`

These routes should be understood as one coherent docs surface, not as random
helper endpoints.

## Canonical Source Rule

The repo-authored docs content is the canonical source.

The platform owns:

1. routing
2. rendering
3. metadata generation
4. search/manifest serialization
5. machine discovery delivery

It does not own a second conflicting authored knowledge base.

## Main Layers

### Docs Registry Layer

The docs registry owns:

1. page definitions
2. sections
3. headings
4. manifest entries
5. search entries

This is the typed index of what the docs surface exposes.

### Docs Rendering Layer

The rendering layer owns:

1. route resolution
2. static params
3. metadata
4. JSON-LD
5. page component loading

### Machine Discovery Layer

The machine discovery layer owns:

1. `/docs-manifest`
2. `/docs-search-index`
3. `/llms.txt`
4. sitemap and robots integration

This is what makes the docs surface retrievable by agents and external tooling
without inventing a second docs product.

### AI-Pack Distribution Layer

The hosted AI-pack manifests live alongside the docs surface because they are
another machine-readable delivery format for the same broad documentation and
agent-guidance system.

## Boundary Rules

1. Public docs pages are the canonical human-facing learning surface.
2. Manifest and search endpoints are machine-oriented indexes, not replacement
   docs.
3. `llms.txt` should summarize and point, not become a shadow documentation
   system.
4. The AI pack is related to the docs surface, but it is not identical to the
   public docs site.

## Design Rules

1. Keep docs page definitions typed and centralized.
2. Keep machine-readable endpoints derived from the same docs registry.
3. Prefer one truthful public docs surface over multiple drifting ones.
4. Treat AI-pack hosting as a delivery format for canonical guidance, not as a
   separate authoring source.
