# Air Jam Documentation Hardening Plan

Last updated: 2026-03-27
Status: active

Related docs:

1. [Documentation Architecture](../documentation-architecture.md)
2. [Documentation Migration Plan](./documentation-migration-plan.md)
3. [Development Loop](../development-loop.md)
4. [Docs Index](../docs-index.md)

## Purpose

The docs migration is essentially complete.

This plan tracks the smaller follow-up work that improves retrieval quality, validation, and maintainability without reopening the docs-system architecture.

## Scope

This plan is for:

1. retrieval/search hardening
2. rendered-docs validation
3. metadata/version polish
4. contributor-guidance cleanup

This plan is not for:

1. another docs-system restructure
2. replacing the current loader/registry boundary
3. introducing a heavy content framework by default

## Current Baseline

Already complete:

1. public docs source is canonical in `content/docs/`
2. the platform docs system is isolated under `apps/platform/src/features/docs/`
3. `/docs`, `/docs-manifest`, `/docs-search-index`, and `/llms.txt` derive from the same docs boundary
4. generated source registration is reproducible and CI-verified
5. heading-level docs search entries are generated from canonical MDX content and exposed through the docs registry/search index
6. heading-level search entries now carry canonical section excerpts, so retrieval is based on real section text instead of only titles and page keywords
7. platform docs tests now render the canonical docs set and verify server-rendered code blocks for pages containing fenced code

## Remaining Workstreams

## 1. Heading-Level Retrieval

Goal:

1. make docs search and machine retrieval work at section level, not only page level

Status:

1. completed

Tasks:

1. extract heading anchors from canonical MDX content
2. merge heading entries into the docs search index
3. carry concise section excerpts into the search index for better fuzzy retrieval
4. optionally expose a dedicated `/docs-headings` endpoint if that proves useful
5. keep page metadata as the primary navigation contract

Acceptance criteria:

1. search can resolve meaningful section-level results
2. heading data is generated from canonical content, not handwritten arrays
3. the machine layer stays thin

## 2. Rendered Docs Validation

Goal:

1. validate rendered docs output, not only metadata and generation integrity

Status:

1. partially completed

Tasks:

1. keep the canonical docs render test in platform CI
2. verify fenced code renders as HTML code blocks
3. verify canonical docs pages resolve successfully
4. optionally promote this to a built-route crawl once the broader platform build is clean
5. optionally add a broken-link pass if it stays lightweight

Acceptance criteria:

1. CI covers rendered docs HTML from the canonical docs source
2. code block regressions are caught automatically
3. route/render failures are caught before release

## 3. Metadata And Version Polish

Goal:

1. make the current docs set more explicit without rebuilding the system

Status:

1. partially completed

Tasks:

1. ensure current docs pages use the canonical metadata contract consistently
2. keep `stability` and `audience` explicit on current public docs pages
3. defer `sinceVersion` and `lastVerifiedVersion` until the first public release cadence is real
4. enrich docs snippets/search metadata where useful
5. only reorganize the `content/docs/` taxonomy if the benefit clearly outweighs the churn

Acceptance criteria:

1. metadata quality is consistent across the public docs set
2. version metadata has a clear operating rule
3. taxonomy changes happen only if they simplify the system

## 4. Contributor And Closeout Cleanup

Goal:

1. make the new docs system the only contributor-facing default

Status:

1. partially completed

Tasks:

1. tighten contributor guidance so public docs work always starts in `content/docs/`
2. keep the platform docs feature module as the only runtime docs boundary
3. keep the migration plan downgraded to reference material rather than an active queue

Acceptance criteria:

1. contributor guidance points to the canonical docs system directly
2. there is no ambiguity about where docs content lives
3. the migration plan no longer reads like active structural work

## Recommended Order

1. rendered docs validation
2. metadata/version polish
3. contributor and closeout cleanup

## Success Condition

This hardening plan is complete when:

1. docs retrieval quality is stronger without adding architectural weight
2. rendered docs regressions are covered by CI
3. metadata/version rules are explicit enough for release use
4. the docs system can be treated as a stable platform surface, not an active migration
