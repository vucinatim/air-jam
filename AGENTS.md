# Agent Contract

This file defines general engineering expectations for contributors and coding agents in this repository.

## Mission

Build and maintain a clean, minimal, and extensible codebase that can scale without unnecessary complexity.

## Core Principles

1. Prefer simple, explicit solutions over clever abstractions.
2. Keep architecture modular and composable.
3. Prioritize long-term maintainability over short-term speed.
4. Avoid hacks that increase future complexity.
5. Refactor when needed instead of layering temporary fixes.
6. DO not assume we are building for backwards compatibility - we want to do full purge refactors when we can.

## Development Standards

1. Make small, focused changes with clear intent.
2. Preserve clear boundaries between core logic, transport/networking, and UI.
3. Keep behavior deterministic where practical.
4. Do not trust client input for authoritative decisions.
5. Add or update tests when behavior changes.
6. Keep public APIs and documentation aligned.

## Quality Gates

Run relevant checks before considering work complete:

1. Type checking
2. Linting
3. Tests
4. Build validation

## Debugging Rule

When debugging uncertain behavior, inspect the unified dev log stream first.

Preferred order:

1. run `pnpm exec air-jam-server logs --view=signal`
2. narrow with `--trace`, `--room`, `--controller`, `--runtime`, `--process`, or `--source`
3. only add temporary ad hoc logging if the unified stream still leaves a real gap

Treat `.airjam/logs/dev-latest.ndjson` as the canonical local debugging stream for server, browser/runtime, platform/Arcade, and workspace-process stories.

## Documentation Discipline

1. Keep intended architecture in `docs/framework-paradigm.md`.
2. Keep the single active repo-wide execution ledger in `docs/work-ledger.md`.
3. Keep the durable follow-up backlog in `docs/suggestions.md`.
4. Keep monorepo workflow guidance in `docs/monorepo-operating-system.md`.
5. Keep navigation pointers in `docs/docs-index.md`.
6. Treat `docs/plans/*.md` as bounded system plans, not duplicate global trackers.
7. Move completed/superseded plan snapshots to `docs/archive/`.
8. Update docs in the same change when contracts or behavior change.

## Follow-Up Tracking Rule

1. Put current work and status changes in `docs/work-ledger.md`.
2. Put multi-step active tracks in `docs/plans/`.
3. Put only durable non-critical follow-ups in `docs/suggestions.md`.
4. Do not turn `docs/suggestions.md` into a second active task tracker.

## Decision Rule

When in doubt, choose the option that reduces complexity, keeps boundaries clear, and makes future changes easier.
