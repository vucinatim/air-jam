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
   pnpm check:ci
   ```
4. `pnpm check:ci` mirrors the lightweight GitHub CI contract: content integrity, typecheck, lint, canonical guard, tests, build, and non-strict perf sanity.
5. Typical local `pnpm test` runtime is around 10 seconds on a modern laptop (server integration tests + sdk unit tests).
6. `pnpm run repo -- perf sanity` is the canonical local server perf check.
7. `pnpm check:release` remains the deeper local prerelease gate with strict perf, browser smoke, and full scaffold tarball smoke.
8. `pnpm check:release:doctor` is the final local release command because it first enforces a clean `pnpm install --frozen-lockfile` before running the heavy prerelease gate.
9. `pnpm check:release:publish` is the lightweight GitHub publish-path sanity gate: typecheck, build, and server lifecycle/routing smoke only.

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
5. `pnpm check:ci` passes for normal PR validation.
6. `pnpm test:scaffold` passes for template/CLI-sensitive changes.
7. `pnpm check:release:publish` passes for the lightweight GitHub package-publish path when you touch the publish workflow itself.
8. `pnpm check:release:doctor` passes before final release sign-off so lockfile drift is caught locally instead of by GitHub Actions.
9. `pnpm check:release` still passes when you need to rerun the heavy local gate without the extra clean-install preflight.
9. Tests relevant to your change pass.
10. Documentation is updated if behavior/API changed.
11. PR description explains:

- what changed
- why it changed
- how it was validated

## Coding Standards

1. Prefer minimal, explicit implementations.
2. Avoid temporary hacks that increase long-term complexity.
3. Preserve deterministic behavior for real-time/multiplayer-critical paths.
4. Do not trust client-provided identity or authority claims.

## Docs and Planning

1. Architecture: `docs/framework-paradigm.md`
2. Active execution ledger: `docs/work-ledger.md`
3. Durable follow-ups: `docs/suggestions.md`
4. Monorepo workflows: `docs/monorepo-operating-system.md`
5. Docs index: `docs/docs-index.md`
