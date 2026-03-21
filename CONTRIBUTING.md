# Contributing to Air Jam

Thanks for contributing.

## Prerequisites

1. Node.js 20+
2. pnpm 9+
3. PostgreSQL (for platform/server flows that need DB)

## Local Setup

1. Clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run the checks you need while developing:
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm test:scaffold
   pnpm perf:sanity
   pnpm build
   ```
4. Typical local `pnpm test` runtime is around 10 seconds on a modern laptop (server integration tests + sdk unit tests).
5. `pnpm perf:sanity` is optional and non-blocking (intended for local regression spotting, not CI gating).

## Development Workflow

1. Make focused changes with clear scope.
2. Keep architecture boundaries clean (core logic, transport/networking, UI).
3. Add or update tests for behavior changes.
4. Update docs in the same PR when contracts or usage change.

## Pull Request Checklist

1. `pnpm typecheck` passes.
2. `pnpm lint` passes.
3. `pnpm build` passes.
4. `pnpm test` passes.
5. `pnpm test:scaffold` passes for template/CLI-sensitive changes.
6. Tests relevant to your change pass.
7. Documentation is updated if behavior/API changed.
8. PR description explains:
   - what changed
   - why it changed
   - how it was validated

## Coding Standards

1. Prefer minimal, explicit implementations.
2. Avoid temporary hacks that increase long-term complexity.
3. Preserve deterministic behavior for real-time/multiplayer-critical paths.
4. Do not trust client-provided identity or authority claims.

## Docs and Planning

1. Active tracker: `docs/implementation-plan.md`
2. Development loop: `docs/development-loop.md`
3. Docs index: `docs/docs-index.md`
