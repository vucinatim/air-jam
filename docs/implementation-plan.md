# Air Jam Implementation Plan

Last updated: 2026-03-21
Status: active

This is the single active execution checklist for Air Jam.

## Goals

1. Keep Air Jam safe and robust under real usage.
2. Remove first-run friction for developers trying Air Jam from GitHub/npm.
3. Add a strong test and CI baseline before touching core networking/security paths.
4. Keep docs, workflow, and agent instructions clean and predictable.
5. Validate critical server paths for correctness, stability, and performance.

## Scope Decision

### Current Milestone: Launch Hardening

1. Testing-first hardening for critical server and SDK networking paths.
2. Security/trust-boundary hardening in server + SDK RPC paths.
3. Docs correctness pass for onboarding/API usage.
4. PR CI gates that enforce all launch-critical checks.

### Next Priority Improvements

1. Arcade discovery UX upgrade (thumbnail/cover/author metadata in cards).
2. Host shell safe-area guidance and default layout contract.
3. Mobile landing-page hero polish pass.

### Explicitly Deferred

1. Full SDK composability migration (`@air-jam/sdk` vs `@air-jam/sdk/ui` split).
2. Full contract-first RPC migration across all examples/templates.
3. Heavy bundle optimization and advanced deployment ergonomics.

## Execution Checklist

## A) Critical-Path Test Foundation (P0)

- [x] Add workspace test setup (Vitest) for `packages/server` and `packages/sdk`.
- [x] Add deterministic socket integration test harness for multi-client scenarios.
- [x] Add root `pnpm test` and package-level test scripts.
- [x] Add PR CI workflow that runs launch-critical checks.

Critical server correctness paths (must be covered by automated tests):
- [x] Host room create/reconnect lifecycle.
- [x] Controller join/leave/rejoin behavior.
- [x] Input routing correctness by room and host focus.
- [x] `system:launchGame` / `system:closeGame` child-host lifecycle.
- [x] Host state sync broadcast behavior.
- [x] Action RPC routing and authorization behavior.
- [x] Auth mode behavior (`disabled` vs `required`) and invalid key handling.
- [x] Rate-limit behavior for host registration and controller join.

Critical server stability/performance paths (must be measured; CI gating can be phased in):
- [x] Reconnect churn test (repeated host/controller disconnect/reconnect cycles).
- [x] Join/leave churn test (rapid controller connect/disconnect bursts).
- [ ] Soak test (long-running room activity with no state/listener leaks).
- [x] Input throughput/latency benchmark under multi-controller load (optional `pnpm perf:sanity`, non-CI).

Exit criteria:
1. Critical-path test suite is green locally and in CI.
2. A baseline performance profile exists and is tracked in repository docs/artifacts.
3. Stability tests show no room/index/listener leak regressions.

## B) Security Hardening (P0)

- [x] Block internal store actions (for example `_syncState`) from controller RPC dispatch.
- [x] Enforce controller socket ownership for `controller:action_rpc` (do not trust payload `controllerId` alone).
- [x] Add host authorization checks where missing (`host:play_sound` and similar host events).
- [x] Add regression tests for forged RPC/controller spoof attempts (tests first, fix second).

Exit criteria:
1. Unauthorized clients cannot trigger host actions.
2. Controller cannot impersonate another controller by payload.
3. Security tests cover these paths and pass in CI.

## C) Reliability and Developer Confidence (P0)

- [x] Add SDK networked-store tests for action proxy behavior and blocked internal actions.
- [x] Add scaffold smoke test for `create-airjam` template create + typecheck/build.
- [x] Add fast failure diagnostics for flaky socket tests (clear timeout/error output).
- [x] Document local test commands and expected runtime in contributor docs.

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

## D) Docs and DX Correctness (P0)

- [ ] Fix SDK README examples to match current API surface.
- [ ] Fix Quick Start references to use actual template files (`AGENTS.md` instead of nonexistent docs).
- [ ] Add concise troubleshooting section for first-run setup (local server, API key, controller join URL issues).
- [ ] Verify template README and platform docs are aligned.

Exit criteria:
1. New developer can follow docs without hitting missing APIs/files.
2. Template and docs describe the same flow and env vars.

## E) UX Conversion Improvements (P1)

- [ ] Expose game media metadata in dashboard settings (thumbnail/cover).
- [ ] Render media and author metadata in arcade browser cards.
- [ ] Add fallback visuals and loading behavior for missing media.
- [ ] Add safe-area/top-overlay contract docs for host UI composition.

Exit criteria:
1. Arcade cards communicate game identity quickly.
2. UI behavior remains stable when media fields are empty/invalid.

## F) Operational Readiness (P1)

- [ ] Define go/no-go checklist run before major visibility pushes/releases.
- [ ] Run production-like smoke pass (create room, join controllers, launch/exit game, publish/unpublish flow).
- [ ] Confirm release workflow and package versions are coherent.
- [ ] Prepare rollback notes (disable publish listing, rotate API key guidance).

## Suggested Sequence

1. A) Critical-path test foundation
2. B) Security hardening (test-driven)
3. C) Reliability and developer confidence
4. D) Docs/DX corrections
5. E) UX conversion improvements
6. F) Final launch gate run

## Release Gate Rules

Go only if all are true:
1. All P0 items are complete.
2. `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` are green.
3. Docs onboarding path is verified end to end from a clean scaffolded project.
4. Critical-path server correctness/stability tests are green.
5. Baseline performance benchmark is recorded and accepted.

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
