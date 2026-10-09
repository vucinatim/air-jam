# Contributing to Air Jam

Thanks for contributing.

## Prerequisites

1. Node.js 22+
2. pnpm via Corepack (`corepack enable`)

The public framework and local room server do not require PostgreSQL or access
to the private managed platform.

## Local Setup

1. Clone the repository.
2. Install dependencies:
   ```bash
   pnpm install --frozen-lockfile
   ```
3. Use the fast checks while developing:
   ```bash
   pnpm check:instant
   pnpm check:changed
   ```
4. `pnpm check:instant` targets a warm runtime of at most one second.
5. `pnpm check:changed` runs cached lint and affected-project TypeScript checks
   in parallel with a warm target of at most five seconds. Use
   `-- --files <paths...>` for the files in the current edit.
6. `pnpm check:batch` runs the slower generated-source, typecheck, lint,
   canonical-guard, and test stages. Use it once before pushing a new system,
   multi-file behavioral refactor, architectural boundary, or roughly `1,000+`
   meaningful changed lines.
7. `pnpm check:ci` is exhaustive pull-request validation; it is not the normal
   local editing loop.
8. `pnpm run repo -- perf sanity` is the canonical local server perf check.
9. `pnpm check:release` remains the deeper local prerelease gate with strict
   perf, server lifecycle smoke, and full scaffold tarball smoke.
10. `pnpm run repo -- pack verify-local --json` validates the exact public package
    set in clean typed consumers, including live server traffic and agent helpers.
11. `pnpm check:release:doctor` enforces a clean frozen install and the heavy
    prerelease gate. Managed platform deployment checks belong to the private repo.
12. `pnpm check:release:publish` is the GitHub publish-path sanity gate.

## Development Workflow

1. Make focused changes with clear scope.
2. Keep architecture boundaries clean (core logic, transport/networking, UI).
3. Add or update tests for behavior changes.
4. Update docs in the same PR when contracts or usage change.

## Pull Request Checklist

1. `pnpm check:changed` passes for the complete focused change.
2. `pnpm check:batch` passes when the substantial-batch rule applies.
3. the pull request's exhaustive CI and required provider previews are green.
4. tests relevant to the change exist at the appropriate batch, CI, or release
   layer.
5. `pnpm test:scaffold` passes for template/CLI-sensitive changes.
6. `pnpm check:release:publish` passes for release or publish behavior.
7. `pnpm check:release:doctor` passes only before final release sign-off.
8. documentation is updated if behavior or APIs changed.
9. the PR description explains:

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
