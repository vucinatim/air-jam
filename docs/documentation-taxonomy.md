# Documentation Taxonomy

Last updated: 2026-08-28
Status: stable reference

This document defines the live documentation categories for Air Jam.

Use it to understand:

1. what each docs directory is for
2. what kinds of docs belong there
3. how live docs should be named

## Core Rule

Keep the live docs surface small, semantically honest, and easy to scan in the
filesystem.

Do not create directory-level README files just to restate category meaning.
Keep taxonomy rules here instead.

## Plans

Path: `docs/plans/`

Use plans for:

1. bounded execution tracks
2. scope and done criteria
3. execution sequence
4. stop rules

Rules:

1. live plan files end in `-plan.md`
2. keep the active set tiny
3. archive plans when they stop governing current work
4. when a large plan has a canonical machine execution manifest, keep that
   manifest outside `docs/` and link it from the plan
5. do not duplicate machine work-item state as Markdown checkboxes

## Architecture

Path: `docs/architecture/`

Use architecture docs for:

1. subsystem boundaries
2. structural explanation of implemented planes
3. durable architecture rules

Rules:

1. architecture docs end in `-architecture.md`
2. keep them stable and date-free
3. do not use them as execution tracking

## Contracts

Path: `docs/contracts/`

Use contract docs for:

1. authoritative state and ownership boundaries
2. protocol and shell contracts
3. startup and environment contracts
4. typed rules implementation must keep satisfying

Rules:

1. contract docs end in `-contract.md` or `-contracts.md`
2. keep them stable and date-free
3. do not use them for broad architecture narrative

## Guides

Path: `docs/guides/`

Use guides for:

1. migration recipes
2. operational loops
3. durable implementation how-to material

Rules:

1. guide docs end in `-guide.md`
2. keep them stable and date-free
3. do not use them as active plans

## Strategy

Path: `docs/strategy/`

Use strategy docs for:

1. stable product direction below vision level
2. workflows, baselines, and deployment models
3. public release and monetization direction

Rules:

1. prefer explicit suffixes like `-strategy.md`, `-workflow.md`,
   `-baseline.md`, or `-topology.md`
2. keep them stable and date-free
3. move dated snapshots to archive

## Content

Path: `docs/content/`

Use content docs for:

1. live public-facing article drafts
2. launch copy that is still being edited

Rules:

1. live drafts end in `-draft.md`
2. plans and outlines do not live here
3. old drafts move to archive when superseded

## Audits

Path: `docs/audits/`

Use audits for:

1. evidence-backed examinations of implemented systems
2. cross-subsystem findings that inform canonicalization or release work
3. decision records showing which findings became executable work

Rules:

1. keep each bounded audit in one semantic subdirectory
2. use `*-audit.md` for lane reports and the final synthesis
3. keep evidence and decisions durable, but keep execution status in the
   canonical readiness manifest
4. do not use audit documents as a parallel backlog
5. archive an audit only when its evidence is no longer relevant to the live
   architecture or release history

## Archive

Path: `docs/archive/`

Use the archive for:

1. closed plans
2. superseded references
3. preserved historical snapshots

Rules:

1. archived snapshots should use date-first names:
   `YYYY-MM-DD-semantic-name.md`
2. keep `README`-style category summaries out of live folders
3. archive before shifting repo focus to another major track
