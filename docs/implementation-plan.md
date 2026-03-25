# Air Jam Implementation Plan

Last updated: 2026-03-25  
Status: active

This is the single active execution checklist for Air Jam.

Architecture baseline: [Framework Paradigm](./framework-paradigm.md)

Rebaseline note:

The previous plan assumed a stronger "platform-owned special runtime" split than we now want.
That work is not all invalid, but it is no longer the architectural source of truth.
Going forward, the implementation plan follows the nested Air Jam model defined in the paradigm doc above.

## Mission (Current Milestone)

Ship the pre-release framework with:

1. One unambiguous framework paradigm.
2. Headless SDK core.
3. Arcade built cleanly from the same Air Jam primitives as standalone apps.
4. Deterministic Arcade host/controller sync from replayable state snapshots.
5. A locked public API that makes misuse difficult by default.

## Ordering Rules (Non-Negotiable)

1. Paradigm and ownership model first.
2. Runtime invariants and sync contracts second.
3. Explicit runtime adapters third.
4. Platform/runtime migration fourth.
5. Template + docs migration fifth.
6. Cleanup and removal last.

No phase jumps unless blockers require temporary parallelization.

## Progress Snapshot

1. Baseline paradigm reset: in progress.
2. Replayable Arcade sync model: pending.
3. Explicit embedded runtime adapter cleanup: pending.
4. Server invariant minimization: pending.
5. Template/docs realignment: pending.
6. Cleanup and release hardening: pending.

## Current Execution Focus

### 1. Lock Ownership Boundaries

- [ ] Define the canonical Arcade state domain that belongs in replicated state.
- [ ] Define the minimal server-owned runtime invariants that stay authoritative.
- [ ] Define the exact responsibilities of the bridge and explicitly ban app-level UI ownership there.

### 2. Fix Arcade/Controller Drift Correctly

- [ ] Replace transient controller UI truth with a replayable Arcade surface snapshot.
- [ ] Make host Arcade UI and controller outer UI derive from the same snapshot.
- [ ] Add a runtime epoch to game surface switches so stale embedded iframes are rejected.

### 3. Reconcile Core Hooks With The Real Paradigm

- [ ] Identify hidden arcade-mode inference still living in generic SDK hooks.
- [ ] Move those behaviors behind explicit embedded runtime adapters over time.
- [ ] Keep standalone APIs simple and generic while preserving nested-runtime support.

### 4. Realign Docs And Templates

- [ ] Rewrite architecture docs and examples around the nested Air Jam model.
- [ ] Ensure create-airjam teaches the same lane separation and ownership model.
- [ ] Remove stale language that frames Arcade as a separate framework paradigm.

## Phase 0: Baseline Freeze (P0)

- [x] Tag/record current passing validation snapshot (`typecheck`, `lint`, `test`, `build`, `test:scaffold`).
- [x] Freeze protocol/event naming changes until Phase 1 contract definitions are approved.
- [x] Add this milestone note to PR template/checklist (if missing): “Does this change align to the implementation plan?”

Exit criteria:

1. Baseline is reproducible from clean checkout.
2. All contributors use this file as the single tracker for framework work.

## Phase 1: Contracts v2 (P0)

### 1A) Introduce Versioned Contract Surface

- [x] Create dedicated versioned contract module(s) for v2 handshake + runtime messages.
- [x] Define handshake payload (runtime kind, sdk version, protocol version, capability flags).
- [x] Define bridge message contract (`BOOTSTRAP`, `PLAYERS_UPDATE`, `GAME_STATE_UPDATE`, `INPUT_FRAME`, `PAUSE`, `RESUME`, `SHUTDOWN`, `READY`, `STATE_PATCH`, `SIGNAL`, `ERROR`, `METRICS`).
- [x] Separate transport-neutral contract types from socket event labels.

### 1B) Validation and Tests

- [x] Add schema validation tests for all v2 contract messages.
- [x] Add version mismatch reject tests.
- [x] Add compatibility rule tests (required fields, unknown message handling policy).

Exit criteria:

1. Contract module is the single source of truth for server/sdk/platform runtime messaging.
2. Deprecated proxy message types are not used in new runtime paths.

## Validation Snapshot (Phase 0 Baseline)

Recorded on: 2026-03-21

1. `pnpm typecheck`: pass.
2. `pnpm lint`: pass (non-blocking baseline-browser-mapping staleness notices observed).
3. `pnpm test`: pass.
4. `pnpm build`: pass.
5. `pnpm test:scaffold`: pass.

Tracking notes:

1. PR checklist template added at `.github/pull_request_template.md`.
2. Protocol/event naming changes are frozen to v2 contract definitions until Phase 2+ runtime integration.

## Phase 2: Server Kernel Split (P0)

### 2A) Structural Refactor

- [x] Split `packages/server/src/index.ts` responsibilities into:
  1. socket gateway
  2. domain room state machine/use-cases
  3. auth/rate-limit/authorization policy layer
  4. broadcast/router layer
- [x] Define explicit room state transitions (SYSTEM focus, GAME focus, launch pending, closing, teardown).
- [x] Centralize ownership guards (host/controller auth checks) in one policy module.

### 2B) Behavioral Consistency

- [x] Preserve existing tested behavior while refactoring (green integration suite at each slice).
- [x] Remove duplicate/legacy event pathways as they become obsolete under v2.
- [x] Delete server backup artifact (`packages/server/src/index.ts.backup`).

### 2C) Test Expansion

- [x] Add state-machine transition tests (valid/invalid transitions).
- [x] Add unauthorized transition attempts coverage (forged close/launch/state mutation attempts).

Exit criteria:

1. Gateway handlers are thin and delegate to domain use-cases.
2. Room transitions are explicit, validated, and test-covered.
3. No backup/legacy artifacts remain in server source.

## Phase 3: SDK Headless (P0)

### 3A) Public API Reshape

- [x] Implement headless session providers (`HostSessionProvider`, `ControllerSessionProvider` naming can finalize during implementation).
- [x] Expose granular hooks only for the headless runtime path (`usePlayers`, `useConnectionStatus`, `useRoom`, `useGetInput`, `useInputWriter`, `useSendSignal`, state hooks).
- [x] Ensure lifecycle is initialized exactly once per role/runtime tree.

### 3B) Internal Cleanup

- [x] Split protocol file into focused contract modules.
- [x] Remove/replace overlapping lifecycle hooks (`useAirJamShell` in core path).
- [x] Move environment resolution/bootstrap logic out of core runtime ownership path.
- [x] Isolate audio iframe settings sync behind explicit adapter initialization (no hidden module-load side effects).
- [x] Constrain or replace networked state RPC magic with explicit contract-safe behavior.

### 3C) Exports

- [x] Remove lifecycle-owning UI components from core root export.
- [x] Provide optional UI exports only through dedicated UI entry/package.

Exit criteria:

1. `@air-jam/sdk` core is headless and does not own rendered UI.
2. One lifecycle path per role is clear and enforced.
3. No deprecated proxy protocol surfaces remain in core path.

## Phase 4: Platform Runtime Migration (P0)

### 4A) Arcade Runtime Ownership

- [x] Introduce explicit arcade runtime manager that owns persistent room/session.
- [x] Keep controllers connected across game switches.
- [x] Implement versioned iframe bridge using v2 contracts (prefer `MessageChannel` where practical).
- [x] Maintain persistent non-overlapping navbar/chrome outside iframe.

### 4B) Controller Runtime

- [x] Remove `useAirJamShell` dependence from platform controller flow.
- [x] Replace query-flag behavior (`airjam_mode`, `airjam_force_connect`) with explicit runtime contract flow.
- [x] Remove debug ingest call from controller page runtime.

### 4C) Behavior and Tests

- [x] Add arcade runtime manager unit tests (selection, launch/exit transitions, auto-launch gating).
- [x] Add platform/runtime behavior tests for:
  1. room persistence across game switches
  2. bootstrap correctness for newly loaded game iframe
  3. controller continuity on switch
  4. pause/resume propagation

Exit criteria:

1. Platform fully owns arcade room lifecycle.
2. Embedded game cannot directly create its own host socket in arcade mode.
3. Game switching does not tear down controller session.

## Phase 5: Template + First-Party Migration (P0)

### 5A) `create-airjam` Template

- [x] Rewrite template to canonical headless pattern only.
- [x] Remove shell-first assumptions and manual transport loop defaults.
- [x] Document official input cadence pattern with `useInputWriter`.
- [x] Keep scaffold smoke tests green after migration.

Notes:

1. Scaffold smoke now defaults to local tarball validation (`@air-jam/sdk` + `@air-jam/server` packed from workspace), which removes publish-order coupling during pre-release hardening.
2. Template dependencies now normalize to semver at scaffold time from workspace ranges, targeting `@air-jam/sdk@^1.0.0`.
3. Registry smoke remains available as an explicit post-publish check (run after publishing `@air-jam/sdk@1.0.0`).

### 5B) First-Party App Migration

- [x] Migrate `apps/prototype-game` to current APIs.
- [x] Migrate platform arcade/play/controller surfaces to the runtime ownership model.
- [x] Validate migration path against externally reviewed examples (`the-office`, `last-band-standing`, `code-review`) and update usage guidance.

### 5C) Docs Rewrite

- [x] Rewrite docs to one canonical architecture path.
- [x] Remove mixed shell+hook lifecycle guidance from primary docs.
- [x] Keep optional advanced sections separate and clearly marked.

Exit criteria:

1. New scaffolded project follows exactly one recommended path.
2. Docs and template match runtime reality.

## Phase 6: Legacy Purge + Release Gate (P0)

### 6A) Hard Deletion Execution

- [x] Remove `packages/sdk/src/hooks/use-air-jam-shell.ts`.
- [x] Remove `packages/sdk/src/AirJamClient.ts`.
- [x] Remove deprecated proxy protocol section from SDK contracts.
- [x] Remove legacy audio API exports (`AudioProvider`, `useAudioLegacy`) if still present.
- [x] Remove lifecycle-owning shell exports from SDK UI entrypoint.

### 6B) Final Validation

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm test:scaffold`
- [x] `pnpm build`
- [ ] Production-like smoke pass:
  1. create room
  2. connect controllers
  3. launch game
  4. switch/exit game
  5. verify controller continuity
  6. publish/unpublish flow sanity check

Notes:

1. Automated coverage for room/controller continuity, launch/exit flow, and routing/security is green through server integration tests and platform runtime tests.
2. Manual publish/unpublish flow sanity check still pending.

Exit criteria:

1. No legacy paradigm APIs remain in the main user path.
2. All release gates are green.
3. Docs + template + runtime behavior are aligned.

## Phase 7: Paradigm Lockdown (P0, Pre-Release)

Goal: enforce one intended path in code, docs, and runtime guardrails so misuse is hard by design.

### 7.0) Lane Separation Contract (Architecture Rule)

Establish and enforce three distinct lanes (non-overlapping responsibilities):

1. Input lane (high-frequency, transient):
   - controller publish: `useInputWriter`
   - host read: `getInput` / `useGetInput`
   - no game-state replication semantics
2. State lane (authoritative, replicated):
   - host-owned shared game state + coarse actions via `createAirJamStore`
   - no per-frame analog input transport through state actions
3. Signal lane (out-of-band UX/system):
   - haptics/toasts/system commands (`useSendSignal`, `sendSystemCommand`)
   - no authoritative gameplay state ownership

Non-goals:

1. No "store as universal transport" pattern.
2. No per-frame controller input via action RPC/store dispatch.

### 7A) Public API Lockdown

- [x] Stop exporting unscoped lifecycle primitives from `@air-jam/sdk` public entrypoints.
- [x] Remove/privatize `AirJamProvider` and low-level socket manager exports from public root/context barrels.
- [x] Keep only scoped provider path public (`HostSessionProvider`, `ControllerSessionProvider`).
- [x] Make scope enforcement strict: host/controller hooks must error when provider scope is missing or wrong (no unscoped fallback).
- [x] Add compile-time/export-surface tests to prevent re-introducing removed exports.
- [x] Enforce role-pure hooks:
  1. host hooks expose only host concerns
  2. controller hooks expose only controller concerns
  3. platform/arcade-specific behavior moves to platform adapters (not core role hooks)

### 7B) Controller Input API Canonicalization

- [x] Define `useInputWriter` as the canonical controller input publish path in API + docs.
- [x] Migrate first-party controller runtime loops to `useInputWriter`.
- [x] Move raw `sendInput` out of primary docs path (advanced-only section) or remove from public API if not required.
- [x] Add tests for expected fixed-tick writer behavior and invalid payload rejection.
- [x] Add docs + lint/CI guardrails that explicitly reject "per-frame input through store actions" examples.

Notes:

1. `sendInput` escape hatch removed from `useAirJamController` public API; controller input publish path is now `useInputWriter` only.

### 7B.1) Input Behavior Model Simplification (Hide Latching Internals)

- [x] Keep transport-level latching internally, but remove `latch` terminology from default developer path.
- [x] Introduce intuitive field behavior semantics for public API/docs (for example: `pulse`, `hold`, `latest`).
- [x] Provide default behavior without extra config:
  1. booleans default to tap-safe `pulse` behavior
  2. vectors default to `latest` behavior
- [x] Keep advanced per-field overrides as opt-in only (advanced section, not quickstart).
- [x] Update `InputManager` and tests to guarantee "button taps are not lost between ticks" under defaults.
- [x] Add migration notes from legacy `latch` config to new behavior semantics.

### 7B.2) Networked Store Canonicalization (State Lane Only)

- [x] Keep `createAirJamStore` as the canonical replicated state lane primitive; do not use it for per-frame input transport.
- [x] Canonical dispatch path: `useStore.useActions()` only in primary docs/template/first-party usage.
- [x] Remove `state.actions.*` from default examples (retain compatibility only if needed, but mark non-canonical).
- [x] Standardize action signature guidance to payload-object style for consistency and argument-order safety.
- [x] Add dev-time guardrails in RPC bridge for non-serializable args / synthetic event payload mistakes with clear errors.
- [x] Replace hidden trailing controller-id injection semantics in canonical docs/API guidance with explicit action context model:
  1. canonical host action shape: `(ctx, payload) => void`
  2. canonical controller call shape: `actions.someAction(payload)`
  3. `ctx.actorId`/`ctx.role` is authoritative and server-derived
- [x] Remove temporary compatibility path for legacy trailing-id actions (full pre-release purge).
- [x] Add tests for canonical `useActions()` dispatch path.
- [x] Add tests for blocked non-serializable RPC args.
- [x] Add tests for internal action filtering.
- [x] Add tests for state lane behavior separation from input lane.
- [x] Add tests for action-context correctness (`ctx.actorId` and role behavior).

### 7B.3) Canonical Tick Helpers

- [x] Provide first-party tick helpers to avoid loop reinvention:
  1. `useControllerTick` (default 16ms cadence)
  2. `useHostTick` (frame/timer-based host loop helper)
- [x] Migrate first-party/template examples to use canonical tick helpers where appropriate.
- [x] Add tests for stable cadence behavior and cleanup/unmount correctness.

### 7C) Configuration Path Simplification

- [x] Remove hook-level config overrides that duplicate provider responsibilities (`forceConnect`, hook-local `apiKey`, hook-local `maxPlayers`) unless absolutely required.
- [x] Establish provider config as the single authoritative runtime config surface.
- [x] Reduce env-var ambiguity: keep one canonical key naming in docs and runtime.
- [x] Add startup validation errors with actionable messages when canonical config is missing.

### 7C.1) Minimal Game Config Contract (Canonical)

- [x] Define a minimal optional game config contract (`airjam.config.ts` or equivalent) as a single source for runtime metadata.
- [x] Keep scope intentionally small (for example: controller path only) to avoid over-configuration.
- [x] Ensure this contract complements providers/hooks rather than creating a second lifecycle paradigm.

Notes:

1. SDK now exports `createAirJamApp` + `env` as the single canonical runtime/session wiring API.
2. Template + prototype + platform wiring now uses `airjam.Host` / `airjam.Controller` wrappers + `airjam.paths.controller`.
3. Removed legacy API key env fallback names from runtime resolution (`VITE_AIR_JAM_API_KEY`, `NEXT_PUBLIC_AIR_JAM_API_KEY`).

### 7D) Runtime Trust-Boundary Hardening

- [x] Replace permissive iframe `postMessage("*")` usage with strict `targetOrigin` derived from normalized game URL.
- [x] Validate `client:loadUi` URL origin/protocol before iframe load on platform controller/runtime.
- [x] Replace hardcoded bridge `sdkVersion` literals with a single source (build/runtime constant) to avoid drift.
- [x] Create one shared URL/origin policy module reused by platform + server for consistent validation rules.
- [x] Add tests for rejected invalid origins/URLs and successful valid bridge bootstraps.

### 7E) First-Party Conformance Sweep

- [x] Remove remaining direct `AirJamProvider` usage in platform surfaces and switch to scoped providers.
- [x] Ensure template, prototype game, and platform all use the same canonical wiring shape.
- [x] Add a static grep-based CI guard that fails on forbidden legacy/unscoped imports and deprecated query-flag patterns.

Notes:

1. Canonical guard now also blocks inline provider config props in runtime first-party paths; session-config modules are the enforced wiring shape.

### 7E.1) Unified Diagnostics Model

- [x] Replace scattered booleans/warns on non-hot paths with structured diagnostics (error codes + actionable messages).
- [x] Keep hot-path APIs fast, but provide optional diagnostics channel for debug/dev builds.
- [x] Define one diagnostics reference table in docs (code, meaning, expected fix).
- [x] Add tests for representative diagnostics emissions on common misuse paths.

### 7F) Docs/LLM Contract Freeze

- [x] Rewrite SDK README quickstart to a single scoped-provider path only.
- [x] Add an explicit "Three Lanes" section (Input / State / Signal) with "use this / do not use this" examples.
- [x] Add explicit "one correct way" section with anti-patterns (what not to do).
- [x] Remove latching jargon from beginner docs; explain behavior in gameplay terms ("tap-safe buttons", "latest stick vector").
- [x] Networked state docs: present one canonical dispatch path (`useActions`) and one canonical action-shape style (payload object).
- [x] Document explicit action context (`ctx.actorId`, `ctx.role`) as the canonical identity model.
- [x] Document canonical tick helpers (`useControllerTick`, `useHostTick`) in quickstart-level examples.
- [x] Keep advanced/escape-hatch content in a separate section clearly marked non-default.
- [x] Sync extracted template docs and verify examples match shipped API exactly.

### 7G) Lockdown Release Gate

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm test:scaffold`
- [x] `pnpm build`
- [ ] Manual E2E sanity:
  1. arcade launch flow
  2. controller continuity through switch/exit
  3. scoped-provider misuse throws clear errors
  4. invalid iframe/runtime URL blocked

Exit criteria:

1. Exactly one documented and supported way to build host/controller runtime flows.
2. Public SDK surface cannot be used in unscoped lifecycle mode.
3. First-party apps/templates conform to canonical architecture with no exceptions.
4. Bridge/runtime messaging path is origin-constrained and version-consistent.
5. CI contains mechanical guards against paradigm regressions.
6. Lane separation is explicit, test-covered, and reflected consistently in SDK README/docs/template/platform usage.
7. Default input behavior is tap-safe and intuitive without requiring developers to understand latching internals.
8. Networked store usage is canonical, typed, and unambiguous with clear state-lane boundaries.
9. Role hooks are pure and do not leak platform-specific runtime concerns.
10. Canonical state actions use explicit server-derived action context (`ctx.actorId`/`ctx.role`) rather than hidden trailing-arg magic.
11. Canonical tick helpers are available and used in first-party/template examples.
12. Diagnostics are structured and actionable for non-hot misuse paths.
13. URL/origin validation policy is centralized and shared across platform and server.

## Optional Post-Launch (P1)

- [ ] Advanced perf/soak automation.
- [ ] Additional UI primitive library expansion.
- [ ] CI-gated performance thresholds.

## Phase 8: Template Canonicality + SDK Ergonomics Hardening (P0, Pre-Release)

Goal: reduce template complexity and ambiguity by moving recurring boilerplate into canonical SDK primitives and simplifying the Pong structure.

### 8A) SDK Ergonomics (Remove Template Workarounds)

- [x] Add controller-side `TOAST` handling as a first-class built-in path (not ad-hoc per template).
- [x] Add canonical controller hook for remote audio events (for example: `useRemoteSound(manifest)`), replacing manual `server:playSound` socket wiring.
- [x] Add canonical presence helper for networked stores so templates do not need custom `connectedPlayerIds` + pruning plumbing.
- [x] Add canonical lifecycle bridge helper for host runtime phase transitions (`lobby/playing/ended` -> runtime pause/play), removing repeated glue logic.
- [x] Expose typed utility to parse/validate remote sound IDs without local `as` casts.

### 8B) Pong Template Refactor (Aesthetic + Minimal)

- [x] Split `controller-view.tsx` into focused components/hooks:
  1. header/status
  2. lobby panel
  3. playing controls
  4. ended panel
  5. connection guard hook
- [x] Extract shared `team` domain module (team ids, labels, colors, formatting helpers) and remove duplicated constants/functions.
- [x] Extract canonical readiness helper (`canStartMatch`) used by store + controller + lobby text.
- [x] Rename stale action `setSoloBotEnabled` -> canonical `setBotEnabled` (or equivalent) across store/docs/template.
- [x] Remove unused controller input fields (drop unused `action` from input schema unless used).
- [x] Replace touch+mouse dual handlers with pointer-event canonical controls.
- [x] Split `host/game-engine.ts` into cohesive modules:
  1. simulation/input
  2. collision/scoring
  3. render
  4. paddle/team selectors
- [x] Move sound manifest import boundary from `host/*` into shared template module (`src/shared/*`) to avoid cross-layer coupling.
- [x] Remove non-essential type assertions and non-null assumptions where clean typed helpers can replace them.

### 8C) Template Dev/Script Hygiene

- [x] Deduplicate shared process/port/spawn logic between `dev-all.mjs` and `dev-secure.mjs` into one small script utility.
- [x] Keep generated template output clean (no built artifacts in template baseline).

### 8D) Docs + Canonical Contract Lock

- [x] Update template README with one short "canonical structure" section matching the refactored file layout.
- [x] Add explicit "what SDK now handles for you" section (toast handling, remote sounds, presence sync, lifecycle bridge).
- [x] Ensure examples in template/docs no longer show manual socket event subscriptions for common feedback paths.

### 8E) Acceptance Gates

- [x] `pnpm --filter my-airjam-game typecheck`
- [x] `pnpm --filter my-airjam-game build`
- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm test:scaffold`

Verification snapshot (March 22, 2026):

- `pnpm --filter my-airjam-game typecheck`
- `pnpm --filter my-airjam-game build`
- `pnpm lint`
- `pnpm test`
- `pnpm test:scaffold`
- `pnpm -C packages/create-airjam smoke:workspace`
- [ ] Manual sanity:
  1. bot enable/disable + team switching cannot deadlock
  2. start gate consistent across host/controller/lobby text
  3. hit feedback: human hitter only on controller; bot hit on host only
  4. score/start/win feedback follows canonical ownership rules
  5. reconnect/disconnect UX disables controls safely

Exit criteria:

1. Pong template has no monolithic role files and no duplicated readiness/format/team constants.
2. Canonical feedback and presence behavior require no manual socket wiring in template code.
3. Template LOC for core role views is materially reduced while preserving behavior.
4. Docs, template, and SDK primitives are aligned to one unambiguous path.

## Merge Discipline For This Milestone

1. One phase-oriented PR at a time (or small adjacent slices).
2. Every behavior change includes tests.
3. Every contract/API change includes docs update in same PR.
4. If a requested shortcut introduces ambiguity, stop and refactor instead.
