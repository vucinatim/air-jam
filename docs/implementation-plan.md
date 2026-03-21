# Air Jam Implementation Plan

Last updated: 2026-03-21
Status: active

This is the single active execution checklist for Air Jam.

## Goals

1. Keep Air Jam safe and robust under real usage.
2. Remove first-run friction for developers trying Air Jam from GitHub/npm.
3. Add a stable test and CI baseline before deeper core refactors.
4. Keep docs, workflow, and agent instructions clean and predictable.

## Scope Decision

### Current Milestone: Launch Hardening

1. Security/trust-boundary hardening in server + SDK RPC paths.
2. Docs correctness pass for onboarding/API usage.
3. Baseline automated tests plus PR CI gates.

### Next Priority Improvements

1. Arcade discovery UX upgrade (thumbnail/cover/author metadata in cards).
2. Host shell safe-area guidance and default layout contract.
3. Mobile landing-page hero polish pass.

### Explicitly Deferred

1. Full SDK composability migration (`@air-jam/sdk` vs `@air-jam/sdk/ui` split).
2. Full contract-first RPC migration across all examples/templates.
3. Heavy bundle optimization and advanced deployment ergonomics.

## Execution Checklist

## A) Security Hardening (P0)

- [ ] Block internal store actions (for example `_syncState`) from controller RPC dispatch.
- [ ] Enforce controller socket ownership for `controller:action_rpc` (do not trust payload `controllerId` alone).
- [ ] Add host authorization checks where missing (`host:play_sound` and similar host events).
- [ ] Add regression tests for forged RPC/controller spoof attempts.

Exit criteria:
1. Unauthorized clients cannot trigger host actions.
2. Controller cannot impersonate another controller by payload.
3. Security tests cover these paths and pass in CI.

## B) Reliability and Testing Baseline (P0)

- [ ] Add workspace test setup (Vitest) for `packages/sdk` and `packages/server`.
- [ ] Add server socket integration tests for room create/join/reconnect/input/action flow.
- [ ] Add SDK networked-store tests for action proxy behavior and blocked internal actions.
- [ ] Add scaffold smoke test for `create-airjam` template create + typecheck/build.
- [ ] Add root scripts for test running and document them.
- [ ] Add PR CI workflow with required gates.

Current gates (already present):
1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm build`

Target gates (after this track):
1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build`
5. `create-airjam` scaffold smoke test

## C) Docs and DX Correctness (P0)

- [ ] Fix SDK README examples to match current API surface.
- [ ] Fix Quick Start references to use actual template files (`AGENTS.md` instead of nonexistent docs).
- [ ] Add concise troubleshooting section for first-run setup (local server, API key, controller join URL issues).
- [ ] Verify template README and platform docs are aligned.

Exit criteria:
1. New developer can follow docs without hitting missing APIs/files.
2. Template and docs describe the same flow and env vars.

## D) UX Conversion Improvements (P1)

- [ ] Expose game media metadata in dashboard settings (thumbnail/cover).
- [ ] Render media and author metadata in arcade browser cards.
- [ ] Add fallback visuals and loading behavior for missing media.
- [ ] Add safe-area/top-overlay contract docs for host UI composition.

Exit criteria:
1. Arcade cards communicate game identity quickly.
2. UI behavior remains stable when media fields are empty/invalid.

## E) Operational Readiness (P1)

- [ ] Define go/no-go checklist run before major visibility pushes/releases.
- [ ] Run production-like smoke pass (create room, join controllers, launch/exit game, publish/unpublish flow).
- [ ] Confirm release workflow and package versions are coherent.
- [ ] Prepare rollback notes (disable publish listing, rotate API key guidance).

## Suggested Sequence

1. A) Security hardening
2. B) Test baseline + CI
3. C) Docs/DX corrections
4. D) UX conversion improvements
5. E) Final launch gate run

## Release Gate Rules

Go only if all are true:
1. All P0 items are complete.
2. `pnpm typecheck`, `pnpm lint`, `pnpm build`, and required tests are green.
3. Docs onboarding path is verified end to end from a clean scaffolded project.

No-go if any are true:
1. Known auth/RPC spoof path remains open.
2. Core onboarding docs still reference wrong APIs/files.
3. CI does not enforce launch-critical gates.

## Development Loop (Humans + LLMs)

1. Pick one checklist item and define acceptance behavior first.
2. Implement minimal change set with clean architecture boundaries.
3. Add or update tests in the same change.
4. Run required gates locally.
5. Update this plan status/checklist and any impacted docs in the same PR.
6. For major architecture follow-ups, add an entry to `suggestions.md`.

## LLM Workflow Contract

1. Read `AGENTS.md` and this plan before changing architecture-sensitive paths.
2. Prefer small, verifiable PRs over broad multi-area edits.
3. Never invent API usage from memory; verify against source code.
4. If a quick fix increases complexity, stop and propose the refactor path first.
5. When behavior/contracts change, update docs in the same PR.
6. Keep this file as the single active execution checklist.

## Archive Policy

When a plan version is complete or superseded, move that snapshot to `docs/archive/done/` with a dated filename and continue this file as the active tracker.
