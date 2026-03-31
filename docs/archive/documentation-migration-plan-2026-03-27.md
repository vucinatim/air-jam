# Air Jam Documentation Migration Plan

Last updated: 2026-03-27
Status: complete

Related docs:

1. [Documentation Architecture](../../systems/documentation-architecture.md)
2. [Framework Paradigm](../../framework-paradigm.md)
3. [Monorepo Operating System](../monorepo-operating-system.md)
4. [Docs Index](../../docs-index.md)
5. [V1 Release Launch Plan](../plans/v1-release-launch-plan.md)

## Purpose

This plan turns the documentation architecture direction into an executable migration.

The goal is:

1. move Air Jam to one clean future-proof docs system
2. phase the work safely
3. complete the migration fully
4. purge superseded structure once the new system is stable

This is not a plan to keep two docs systems alive forever.

## Status Summary

The migration is now structurally complete.

Completed:

1. public docs moved to the canonical `content/docs/` source
2. the platform renders docs through one dedicated docs module
3. machine-readable endpoints derive from the same docs boundary
4. generated docs source registration is reproducible and CI-verified
5. the old in-app docs content source has been removed

Remaining work is now release-facing closeout work, tracked in the canonical [V1 Release Launch Plan](../plans/v1-release-launch-plan.md).

Contributor-facing guidance should now treat this plan as reference material, not an active work queue.

## End State

The intended end state is:

1. internal maintainer/system docs continue to live in root `docs/`
2. public framework docs live in one canonical content source
3. platform renders public docs from that source
4. navigation/search/manifests derive from page metadata
5. `llms.txt` and agent-facing pages remain a thin curated access layer
6. old public-docs source paths inside the platform app are removed once cutover is complete

## Canonical Target Structure

```text
docs/
  framework-paradigm.md
  work-ledger.md
  monorepo-operating-system.md
  systems/
    documentation-architecture.md
  strategy/
    release-workflow.md
  plans/
  archive/
  internal/
    maintainers/
    platform/
    studio/

content/
  docs/
    concepts/
    guides/
    reference/
    contracts/
    migrations/
    for-agents/
  generated/
    docs-manifest.json
    docs-search-index.json
    docs-headings.json

apps/platform/
  src/app/docs/...
  src/app/llms.txt/route.ts
  src/app/docs-manifest/route.ts
  src/app/docs-search-index/route.ts
```

## Current Starting Point

The current implemented state is:

1. public docs content lives in `content/docs/`
2. the platform renders docs through `apps/platform/src/features/docs/`
3. `apps/platform/src/app/docs/[...slug]/page.tsx` is the delivery route
4. `/docs-manifest` and `/docs-search-index` are already live machine endpoints
5. `apps/platform/src/features/docs/generated/content-docs.generated.ts` is generated from `content/docs/**/page.docs.ts`
6. CI now verifies that generated docs source output is not stale before the normal platform gates run

This means the extraction cutover is complete.

The main remaining docs-system work is:

1. deciding whether a stronger public-docs taxonomy split is worth the additional churn
2. adding richer heading/search extraction over the canonical content source
3. adding a docs-crawl check so rendered HTML invariants are covered, not just metadata integrity

These are now considered hardening tasks rather than blockers for the migration itself.

## Decisions To Freeze Before Implementation

These decisions should be treated as required inputs to the migration.

### 1. Canonical Public Docs Source

Final source location:

1. `content/docs/`

### 2. Public Docs Taxonomy

Canonical page types:

1. `concept`
2. `guide`
3. `reference`
4. `contract`
5. `migration`
6. `agent`

### 3. Metadata Schema

Every public docs page should support:

1. `title: string`
2. `description: string`
3. `docType: "concept" | "guide" | "reference" | "contract" | "migration" | "agent"`
4. `keywords: string[]`
5. `sinceVersion?: string`
6. `lastVerifiedVersion?: string`
7. `stability?: "stable" | "evolving" | "experimental"`
8. `audience?: "user" | "maintainer" | "agent" | "studio"`
9. `section?: string`
10. `order?: number`

Frontmatter or equivalent page metadata must be parseable outside Next's native `app/` MDX routing.

### 4. Minimal Machine Surface

Canonical machine-readable outputs:

1. `/llms.txt`
2. `/docs/for-agents`
3. `/docs-manifest`
4. `/docs-search-index`

Optional later:

1. `/docs-headings`

### 5. Versioning Rule

Canonical rule:

1. latest stable docs live at `/docs`
2. page metadata carries version information
3. full versioned snapshots are introduced only on meaningful compatibility divergence

## Migration Phases

## Critical Implementation Constraint: The MDX Compilation Bridge

Once public docs move out of `apps/platform/src/app/docs/`, Next.js will no longer compile those `.mdx` files automatically through native app-directory routing.

That means the migration requires an explicit **MDX compilation bridge** inside `apps/platform`.

This bridge must handle:

1. reading docs source files from the canonical content directory
2. parsing page metadata
3. compiling MDX content
4. rendering MDX with the platform's component mapping
5. generating machine-readable manifest/search artifacts from the same source

This is a core implementation requirement, not an optional nice-to-have.

## Tooling Direction

Air Jam should prefer the smallest stable solution that keeps ownership clear.

### Recommended Initial Path

Recommended first implementation:

1. filesystem-backed docs loader
2. metadata parsing with a minimal parser such as frontmatter parsing
3. schema validation with `zod`
4. MDX rendering through a lightweight server-side MDX compilation path
5. generated manifest/search artifacts from the same loader

In practice, this means a lightweight custom docs pipeline rather than a heavy content framework first.

### Preferred Bridge For The Current Platform

For this repo specifically, the preferred bridge is to extend the platform's existing MDX stack rather than introduce a second content system.

That means:

1. keep `content/docs/` as plain source files
2. add one docs loader module that discovers files, parses frontmatter, validates metadata, and maps slugs
3. compile/render MDX through the platform's existing MDX toolchain and component mapping
4. derive manifest/search artifacts from that same loader contract

This is the cleanest path because the platform already has:

1. MDX support in `next.config.ts`
2. a custom MDX loader
3. a shared MDX component map in `src/mdx-components.tsx`
4. existing rehype/highlighting behavior we already want docs pages to keep

So the first implementation should be:

1. `gray-matter` or an equivalent minimal frontmatter parser
2. `zod` for metadata validation
3. one filesystem-backed docs loader in the platform app
4. one server-side MDX compile/render path reused by docs routes

### What We Should Not Do First

Do not start by adding a heavy content system just because extracted MDX needs a bridge.

For the current Air Jam size, that means:

1. do not default to Contentlayer-style build databases
2. do not introduce a second docs-specific runtime when the platform already has MDX infrastructure
3. do not split docs rendering across two unrelated MDX pipelines unless forced by a real limitation

`next-mdx-remote` is acceptable if it becomes the simplest way to complete the extracted-content render path cleanly, but it should not be treated as the architectural goal by itself.

The goal is:

1. one canonical content source
2. one metadata contract
3. one loader contract
4. one MDX rendering path as far as practical

Why this is the recommended first path:

1. Air Jam's docs set is still small
2. we want minimal moving parts
3. we want full ownership of docs structure and routing
4. we do not need a large content abstraction layer yet
5. this keeps the platform as a renderer over a simple canonical content source

### Recommended Non-Goal For Phase 1

Do not begin with a heavy docs-content abstraction unless the lightweight path clearly fails.

That means:

1. do not make Contentlayer-style generated content databases the default starting assumption
2. do not introduce a large content framework only because extracted MDX requires a bridge

### If The Lightweight Path Stops Scaling

If the docs system later needs:

1. more aggressive type generation
2. more sophisticated build-time collection features
3. broader content tooling ergonomics across many collections

then Air Jam can evaluate a typed content framework later.

But that should be a second-step decision, not the default migration starting point.

## Phase 1. Contracts And Metadata

Goal:

1. define the content contract before moving source

Tasks:

1. define the MDX page metadata export shape
2. define the public docs taxonomy
3. define the navigation derivation rule
4. define contributor ownership rules for internal vs public docs
5. update docs contribution guidance if needed

Implementation targets:

1. `docs/systems/documentation-architecture.md`
2. new metadata helper module in platform or shared docs tooling
3. contributor-facing guidance docs if needed
4. choose the exact MDX compilation bridge approach for the extracted-content system

Acceptance criteria:

1. every new public docs page has an explicit metadata contract
2. page purpose is classifiable by one canonical doc type
3. ownership boundaries are written down, not assumed

## Phase 2. Metadata Adoption In Current Platform Docs

Goal:

1. make public docs metadata-driven before folder extraction

Tasks:

1. add metadata exports to current MDX pages
2. stop treating handwritten navigation as the only canonical source of docs metadata
3. derive docs manifest/search inputs from page metadata
4. preserve current site behavior during the transition
5. prototype the loader contract against the current docs source before folder extraction

Current source paths involved:

1. legacy source: `apps/platform/src/app/docs/**/*.mdx`
2. current canonical source: `content/docs/**/page.mdx`

Acceptance criteria:

1. public docs pages expose canonical metadata
2. a generated or assembled docs manifest exists from page metadata
3. manual docs index duplication is reduced

## Phase 3. Machine Surface Generation

Goal:

1. make agent/search retrieval derive from canonical docs metadata

Tasks:

1. generate `docs-manifest.json`
2. generate `docs-search-index.json`
3. optionally generate heading index data
4. update `llms.txt` to link to the canonical machine endpoints
5. expand `/docs/for-agents` to align with the new structure

Platform endpoints to add:

1. `apps/platform/src/app/docs-manifest/route.ts`
2. `apps/platform/src/app/docs-search-index/route.ts`

Likely supporting modules:

1. `apps/platform/src/features/docs/registry.ts`
2. `apps/platform/src/features/docs/metadata.ts`

Acceptance criteria:

1. agents can discover docs through a canonical public manifest
2. search data comes from metadata, not only from manual arrays
3. the machine layer remains thin and explainable
4. generation logic is driven by the same docs loader contract planned for extracted content

## Phase 4. Public Docs Source Extraction

Goal:

1. move public docs content out of the platform app and into a canonical content source

Status:

1. completed

Implemented shape:

1. `content/docs/` is now the canonical public docs source
2. URLs stayed stable under `/docs/...`
3. the platform now renders docs through `apps/platform/src/features/docs/content-docs-source.ts`
4. `apps/platform/src/app/docs/[...slug]/page.tsx` is the content delivery route

Target source shape:

1. route-stable content folders under `content/docs/`
2. page-local metadata via `page.docs.ts`
3. MDX content in neighboring `page.mdx` files

Acceptance criteria:

1. platform docs render from the canonical content source
2. public docs are no longer trapped inside app routing folders as the source of truth
3. page metadata and machine outputs still work after extraction
4. the platform no longer depends on native app-directory MDX compilation as the canonical docs-source mechanism

## Phase 5. Navigation And Search Simplification

Goal:

1. replace duplicated manual structures with metadata-driven structures

Status:

1. substantially completed

Tasks:

1. keep generated docs source assembly as the only source-registration path
2. derive docs search entries from canonical metadata and heading data
3. keep manual curation only where it adds value, such as homepage grouping and sidebar ordering
4. preserve the CI generated-source integrity check so docs routing metadata cannot drift silently

Acceptance criteria:

1. metadata is canonical
2. curated navigation is an adapter, not a second source of truth
3. search and public manifests stay aligned automatically
4. generated docs source output is reproducible and CI-verified

## Phase 6. Full Cutover And Purge

Goal:

1. remove superseded structure after the new system is stable

Status:

1. largely completed

Tasks:

1. remove deprecated public-docs source under `apps/platform/src/app/docs/` if it is no longer canonical
2. remove obsolete manual docs indexing structures
3. remove transitional compatibility code no longer needed
4. update contributor guidance to reference only the new system
5. archive any migration notes that are no longer active

Acceptance criteria:

1. there is one canonical public docs source
2. there is one canonical metadata model
3. old fallback structures are gone
4. the migration is complete, not half-complete

## File Move Plan

This is the intended move from current public docs source to the target source.

### Current

```text
apps/platform/src/app/docs/getting-started/introduction/page.mdx
apps/platform/src/app/docs/getting-started/quick-start/page.mdx
apps/platform/src/app/docs/how-it-works/architecture/page.mdx
apps/platform/src/app/docs/sdk/hooks/page.mdx
...
```

### Target

```text
content/docs/concepts/introduction.mdx
content/docs/guides/quick-start.mdx
content/docs/concepts/architecture-overview.mdx
content/docs/reference/hooks.mdx
...
```

The exact filenames may differ, but the rule should hold:

1. content location should reflect document purpose
2. app routes should not be the content source contract

## Routing Rule

User-facing URLs should remain product-friendly even if content folders change.

That means:

1. content taxonomy does not need to equal final public URL shape
2. routing and URL mapping should be handled by the platform delivery layer

Examples:

1. content may live at `content/docs/reference/hooks.mdx`
2. public URL may still remain `/docs/sdk/hooks`

This keeps compatibility and branding separate from source organization.

## Component Rule

Docs-specific React components should remain in the platform app or a shared presentation layer.

Good examples:

1. code block renderers
2. diagrams
3. docs layout wrappers
4. TOC/search UI

Docs content should import presentation components, but those components should not own canonical docs content.

## Loader Rule

The docs loader should become the canonical bridge between content source and platform delivery.

That loader should own:

1. file discovery
2. metadata parsing
3. metadata validation
4. slug and route mapping
5. machine artifact generation inputs

The page route should not reimplement these concerns ad hoc.

## Generated Artifact Rule

Generated docs artifacts should never become hand-edited source.

Generated outputs should be:

1. reproducible
2. disposable
3. clearly marked as generated

Current locations:

1. code-generation outputs that are required at build/runtime live beside the docs feature in `apps/platform/src/features/docs/generated/`
2. public machine-readable artifact snapshots can live under `content/generated/` later if they need to exist outside the app runtime

## Contributor Rule

Once migrated:

1. internal architecture and maintainer docs go into root `docs/`
2. public framework docs go into `content/docs/`
3. agent-facing public guidance also lives with public docs content
4. generated docs outputs are never edited directly

This rule must be reflected in contributor-facing docs when the migration completes.

## Validation

The migration should be validated at each phase.

### Required Validation

1. docs routes still render correctly
2. code blocks still render correctly
3. docs search still works
4. `llms.txt` still points to canonical docs
5. generated manifest/search outputs match current docs set
6. generated docs source output is verified as current in CI
7. links and heading anchors remain stable or are redirected appropriately

### Recommended Additional Validation

1. add a docs-crawl build check
2. add a manifest consistency check
3. add a broken-link check for public docs pages

## Non-Goals

This migration should not try to:

1. auto-generate conceptual prose
2. rewrite all docs content unnecessarily
3. introduce full multi-version docs immediately
4. merge internal maintainer docs with public framework docs

## Priority Order

Recommended implementation order:

1. Phase 1: contracts and metadata
2. Phase 2: metadata adoption in current source
3. Phase 3: machine surface generation
4. Phase 4: source extraction
5. Phase 5: navigation/search simplification
6. Phase 6: full cutover and purge

This is the safest order because it moves contracts first, structure second, and purge last.

## Closeout Rule

This migration is complete only when:

1. the canonical public docs source has moved to the new system
2. machine-readable access derives from canonical metadata
3. old public docs source and fallback indexing structures are removed
4. contributor guidance references only the new system

All structural conditions above are now satisfied. Remaining follow-up should be treated as release-facing quality work under the canonical [V1 Release Launch Plan](../plans/v1-release-launch-plan.md).
