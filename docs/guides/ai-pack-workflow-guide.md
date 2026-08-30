# AI Pack Workflow Guide

Last updated: 2026-05-08  
Status: current guide

Related docs:

1. [../contracts/ai-pack-manifest-contract.md](../contracts/ai-pack-manifest-contract.md)
2. [../architecture/documentation-and-ai-pack-architecture.md](../architecture/documentation-and-ai-pack-architecture.md)
3. [../architecture/platform-docs-surface-architecture.md](../architecture/platform-docs-surface-architecture.md)

## Purpose

This guide explains the intended workflow for projects consuming the hosted Air
Jam AI pack.

## What The AI Pack Is For

The AI pack gives scaffolded projects a managed bundle of:

1. local framework references under `docs/airjam/`
2. generated snapshots of canonical public docs under
   `docs/airjam/generated/`

Scaffolding also creates bootstrap-only top-level instructions and local skills.
Those files belong to the project after creation and are not part of the
managed update set.

## Canonical Commands

From a scaffolded project root:

```bash
pnpm exec airjam ai-pack status --dir .
pnpm exec airjam ai-pack diff --dir .
pnpm exec airjam ai-pack update --dir .
```

## Intended Workflow

### `status`

Use this first when you want to know whether the local project is behind the
hosted canonical pack.

### `diff`

Use this when you want to inspect exactly which managed files differ.

### `update`

Use this only when you explicitly want to replace AI-pack-managed files with the
current canonical versions.

## Ownership Rule

The AI pack owns only AI-pack-managed files.

It does not own:

1. `AGENTS.md` or `CLAUDE.md`
2. project-local skills
3. user-created project notes
4. arbitrary application code
5. local custom docs outside `docs/airjam/`

## Important Behavior

1. the workflow is compare-first, then replace
2. updates are explicit
3. updates are not merge operations
4. local manifest state is stored at `.airjam/ai-pack.json`

## Design Rule

If you want to preserve local edits to AI-pack-managed files, inspect drift with
`status` and `diff` first. Do not treat `update` as a safe merge command.
