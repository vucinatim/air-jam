# Air Jam Development Loop

Last updated: 2026-03-21

This is the default implementation loop for launch-period work.

## 1) Pick Scope

1. Pick one checklist item from `docs/implementation-plan.md`.
2. Define acceptance behavior before touching code.
3. Confirm whether it is P0 (launch-blocking) or P1 (post-launch acceptable).

## 2) Implement Minimal Changes

1. Prefer the smallest safe change that solves the problem.
2. Do not add abstractions unless they clearly reduce complexity.
3. If the fix requires architecture changes, document the boundary and keep the first patch incremental.

## 3) Add or Update Tests

1. Add regression tests for every security/trust-boundary fix.
2. Add/update integration tests for socket flows when behavior changes.
3. Keep tests focused on observable behavior, not internals.

## 4) Run Required Gates

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm build`
4. `pnpm test` (once baseline test setup is in place)

## 5) Update Docs in Same Change

1. Update affected docs immediately when contracts/behavior change.
2. Keep `docs/implementation-plan.md` as the single active checklist.
3. Track non-launch architecture follow-ups in `suggestions.md`.

## 6) Merge Discipline

1. Keep PRs small and single-purpose.
2. Include what changed, why, and validation evidence.
3. For launch phase, prioritize P0 completion over broad refactors.
