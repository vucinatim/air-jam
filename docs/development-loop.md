# Air Jam Development Loop

Last updated: 2026-03-21

This is the default implementation loop for launch-period work.

## 1) Pick Scope

1. Pick one checklist item from `docs/implementation-plan.md`.
2. Define acceptance behavior before touching code.
3. Confirm whether it is P0 (launch-blocking) or P1 (post-launch acceptable).
4. For critical networking/security paths, define tests first.

## 2) Implement Minimal Changes

1. Prefer the smallest safe change that solves the problem.
2. Do not add abstractions unless they clearly reduce complexity.
3. If the fix requires architecture changes, document the boundary and keep the first patch incremental.

## 3) Add or Update Tests

1. Add regression tests for every security/trust-boundary fix.
2. Add/update integration tests for socket flows when behavior changes.
3. Keep tests focused on observable behavior, not internals.
4. For server-critical paths, include correctness + stability checks (and performance baseline when relevant).

## 4) Run Required Gates

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build`
5. When touching networking/perf-sensitive server paths, run optional `pnpm perf:sanity`.

## 4a) Template / Scaffold Validation

When touching `create-airjam`, templates, or package boundary behavior:

1. Keep template files canonical for workspace development.
2. Do not rely on publish-time mutation of template dependencies or Vite config.
3. Validate workspace scaffolds with `pnpm test:scaffold:workspace`.
4. Validate unpublished-package behavior with `pnpm test:scaffold:tarball`.
5. If you need local artifacts for another repo, use `pnpm pack:local`.

## 5) Update Docs in Same Change

1. Update affected docs immediately when contracts/behavior change.
2. Keep `docs/implementation-plan.md` as the single active implementation tracker or summary, and archive detailed completed plans under `docs/archive/done/`.
3. Track non-launch architecture follow-ups in `suggestions.md`.

## 5a) Docs Contribution Rules

When a change touches documentation or public framework contracts:

1. Put public framework docs content in `content/docs/`, not under `apps/platform/src/app/docs/`.
2. Keep page-local metadata in neighboring `page.docs.ts` files and treat that metadata as canonical.
3. Treat `apps/platform/src/features/docs/` as the only runtime/docs delivery boundary for the platform app.
4. Do not edit `apps/platform/src/features/docs/generated/content-docs.generated.ts` directly; regenerate it through the platform docs scripts.
5. Put maintainer-only docs, plans, and architectural notes in root `docs/`.
6. Update docs tests/manifests in the same change when public docs behavior or metadata changes.

## 6) Merge Discipline

1. Keep PRs small and single-purpose.
2. Include what changed, why, and validation evidence.
3. For launch phase, prioritize P0 completion over broad refactors.
