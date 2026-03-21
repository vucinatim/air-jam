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

## Documentation Discipline

1. Keep one active implementation tracker in `docs/implementation-plan.md`.
2. Keep workflow guidance in `docs/development-loop.md`.
3. Keep navigation pointers in `docs/docs-index.md`.
4. Move completed/superseded plan snapshots to `docs/archive/done/`.
5. Update docs in the same change when contracts or behavior change.

## Decision Rule

When in doubt, choose the option that reduces complexity, keeps boundaries clear, and makes future changes easier.
