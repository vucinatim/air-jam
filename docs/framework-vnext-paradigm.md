# Air Jam vNext Paradigm

Date: 2026-03-21  
Status: Proposed (pre-release, breaking changes allowed)  
Intent: Define the single unambiguous framework model before public release.

## Why this shift

Current usage in real vibecoded games exposed recurring ambiguity:

1. Mixed paradigms (shell + hooks + custom DOM hacks).
2. Duplicate lifecycle wiring risks.
3. Ambiguous input publishing patterns.
4. UI/theme coupling causing brittle overrides.
5. No single obvious way to build for both standalone and arcade embedding.

Pre-release is the only low-cost moment to remove this ambiguity permanently.

## North Star

Air Jam should have one obvious correct model:

1. Core SDK is headless runtime only.
2. Lifecycle is initialized exactly once per role.
3. APIs are granular and composable, not monolithic role objects.
4. Arcade container owns persistent room/session and chrome.
5. Game UI is always app-owned and never forced by SDK.

## Core Principles

1. Single Responsibility:
   Core handles transport/state/protocol. Game handles rendering. Arcade handles platform chrome.
2. Explicitness Over Magic:
   No hidden lifecycle side effects from UI components.
3. One Way In:
   One startup primitive per role (`HostSession`, `ControllerSession`).
4. Headless First:
   Optional UI package can exist, but not in core.
5. Stable Runtime Contracts:
   Typed protocol + runtime invariants + versioned bridge.

## Target Architecture

### 1) Packages

1. `@air-jam/sdk` (core, headless only)
   - Session lifecycle
   - Input/state/signal APIs
   - Transport abstraction
   - Types and protocol
2. `@air-jam/ui` (optional, presentation only)
   - Reusable host/controller chrome components
   - Zero lifecycle ownership
3. `@air-jam/arcade-runtime` (platform container runtime)
   - Persistent host room/session
   - Iframe orchestration
   - Bridge transport endpoint
   - Persistent navbar/chrome

### 2) Runtime Ownership

1. Standalone game:
   - Game app owns host session (`SocketTransport`).
2. Arcade game:
   - Arcade runtime owns host session and room lifecycle.
   - Embedded game uses `BridgeTransport` only.
   - Controllers remain connected across game switches.

## Non-Negotiable Contracts

1. Exactly one active session per role per runtime tree.
2. In arcade mode, game cannot create direct socket host connection.
3. Controller IDs persist for lifetime of room.
4. Game switch must not tear down room.
5. Input latch buffers reset on game switch.
6. Protocol handshake must include runtime + game SDK version.

## API Direction (Conceptual)

Note: names can still change, but responsibilities must not.

### Session Primitives

1. `HostSessionProvider`
2. `ControllerSessionProvider`

These own connection lifecycle and role state.

### Granular Hooks (No Monolithic Host/Controller Object)

1. `usePlayers()`
2. `useConnectionStatus()`
3. `useRoom()`
4. `useGameState()`
5. `useSetGameState()` (explicit; no toggle-only API)
6. `useGetInput()` (host side)
7. `useInputWriter()` (controller side, declarative cadence)
8. `useSendSignal()`
9. `useSessionErrors()`

### Input Publishing Model

Controller code should use one canonical writer API:

1. `setInput(next)` for full input shape updates.
2. `patchInput(partial)` for incremental updates.
3. Runtime-configured cadence strategy:
   - `event` (publish on change)
   - `fixedTick` (publish at fixed Hz)

No manual RAF transport loops required for default usage.

## Arcade Embedding Model

## Container Chrome (Persistent, Non-Overlay)

Arcade renders a persistent top navbar outside iframe layout:

1. Navbar is always visible and non-overlapping.
2. Iframe is laid out beneath navbar (`height = viewport - navbar`).
3. Platform actions (pause/resume/room/players/QR) live in container chrome.

Games never need CSS hacks against platform chrome.

## Persistent Room Across Game Switches

Flow:

1. Arcade opens room once and maintains host transport.
2. Controllers join once and remain connected.
3. Game iframe A unloads, iframe B loads.
4. Arcade sends bootstrap snapshot to iframe B:
   - room metadata
   - player roster
   - current game state
   - runtime capabilities
5. iframe B starts immediately with existing session context.

## Bridge Protocol (Versioned)

Parent -> Game:

1. `BOOTSTRAP`
2. `PLAYERS_UPDATE`
3. `GAME_STATE_UPDATE`
4. `INPUT_FRAME`
5. `PAUSE`
6. `RESUME`
7. `SHUTDOWN`

Game -> Parent:

1. `READY`
2. `STATE_PATCH`
3. `SIGNAL`
4. `ERROR`
5. `METRICS`

Transport:

1. Prefer `MessageChannel` over loose global message listeners.
2. Validate every message against schema.
3. Reject mismatched protocol version early.

## Elimination of Existing Ambiguity

1. No shell in core -> no shell/hook lifecycle duplication.
2. No forced dark/theming in core -> no `.dark` stripping hacks.
3. Granular hooks only -> no `[host]` / `[controller]` dependency traps.
4. Official input writer -> no ad-hoc transport cadence divergence.
5. Arcade-owned room lifecycle -> seamless multi-game session continuity.

## Migration Strategy (Breaking, Pre-Release)

### Phase 1: Introduce vNext in parallel

1. Add new headless session APIs.
2. Add transport interface (`socket`, `bridge`).
3. Implement arcade bridge runtime.

### Phase 2: Migrate first-party examples

1. `apps/prototype-game`
2. `the-office`
3. `last-band-standing`
4. `code-review`
5. create-airjam template

### Phase 3: Remove legacy API before public launch

1. Remove core `HostShell`/`ControllerShell`.
2. Remove monolithic role hooks from core exports.
3. Keep optional UI in separate package only.

No soft deprecation policy needed pre-release.

## Guardrails and Enforcement

1. Runtime assertions:
   - enforce single session instance
   - forbid direct socket in arcade child mode
2. Lint rules:
   - disallow legacy APIs
   - disallow whole-role-object effect deps
3. Template policy:
   - only ship canonical vNext structure
4. Docs policy:
   - exactly one default architecture path
   - advanced patterns explicitly marked

## Acceptance Criteria

vNext is accepted when all are true:

1. A new game can be built from template with no undocumented decisions.
2. Same game runs in standalone and arcade by transport swap only.
3. Switching games in arcade preserves room and controller session.
4. No first-party game uses DOM selector hacks against SDK internals.
5. No first-party game uses role-object dependency anti-patterns.

## Risks

1. Short-term migration workload across existing sample games.
2. Temporary API churn while vNext settles.
3. Need strict sequencing to avoid mixed old/new paradigms in repo.

These are acceptable pre-release costs for long-term clarity.

## Immediate Next Decisions

1. Finalize exact vNext API names/signatures.
2. Define bridge protocol schema and versioning policy.
3. Decide whether `@air-jam/ui` ships at vNext launch or follows later.
4. Approve removal list of legacy exports from `@air-jam/sdk`.

---

## Comprehensive Rewrite Baseline (Full Codebase Audit)

Date: 2026-03-21  
Scope audited: `packages/sdk`, `packages/server`, `packages/create-airjam`, `apps/platform`, `apps/prototype-game`, root docs/workflows

Status note: this section is an audit snapshot captured before the purge/migration execution.  
Use `docs/implementation-plan.md` as the live status tracker.

This section is the baseline for the rewrite execution plan.  
Goal: complete cleanup, one unambiguous architecture, no legacy/deprecated pathways left in public behavior.

## 1) Current Codebase Diagnosis (By Subsystem)

### 1.1 SDK (`packages/sdk`)

Current structure mixes too many responsibilities in one package surface:

1. Headless runtime + connection orchestration.
2. UI shells/components (`HostShell`, `ControllerShell`) that own runtime behavior.
3. Bridge/proxy behavior inside controller hooks.
4. Audio runtime + global iframe settings sync listener at module-load.
5. Networked Zustand RPC abstraction.

Critical ambiguity sources:

1. `HostShell` calls `useAirJamHost()` internally while games also call it.
2. `useAirJamHost`, `useAirJamController`, and `useAirJamShell` overlap in lifecycle ownership.
3. `protocol.ts` includes both core contracts and deprecated proxy protocol.
4. `index.ts` exports core + UI + legacy paths from one root entry.
5. `AirJamClient.ts` was effectively dead/legacy at audit time.

### 1.2 Server (`packages/server`)

Current server logic is in one very large event file (`src/index.ts`) with many concerns interleaved:

1. Socket gateway wiring.
2. Auth and rate-limit policy.
3. Room lifecycle/state machine behavior.
4. Arcade launch/join token flow.
5. Focus routing.
6. RPC/state-sync forwarding.

Structural issues:

1. No explicit room state machine module (state transitions are implicit).
2. Event handling is hard to reason about and hard to test in isolation.
3. Legacy and current host flows coexist (`host:register`, `host:createRoom`, `host:registerSystem`, `host:joinAsChild`) without one canonical model.
4. Backup artifact exists in source (`src/index.ts.backup`).

### 1.3 Platform (`apps/platform`)

Arcade runtime currently depends on SDK shell/runtime patterns that vNext is trying to eliminate:

1. `ArcadeSystem` uses `HostShell` + `useAirJamHost` directly.
2. `app/controller/page.tsx` uses `useAirJamShell` and iframe query-flag protocol (`airjam_mode`, `airjam_force_connect`) to switch behavior.
3. Controller page contains debug ingest fetch hardcoded to localhost.
4. Arcade page intentionally resets persisted room state on reload, conflicting with persistent room goals.

UI behavior itself is improving (media thumbnails/video/author), but runtime ownership is still mixed between platform and SDK shell.

### 1.4 Create Tooling + Template (`packages/create-airjam`)

Template still encodes old paradigm:

1. Uses `HostShell`/`ControllerShell` directly.
2. Encourages controller RAF send-loop/manual transport behavior.
3. Starter docs are generated from platform docs that still explain mixed legacy/current models.

Result: new projects start from ambiguous architecture immediately.

### 1.5 Prototype & Example Surfaces (`apps/prototype-game` + external review)

Observed behavior confirms API ambiguity:

1. Frequent whole-object hook dependencies (`[host]`, `[controller]`).
2. Shell/style hacks to override SDK-owned UI/theming.
3. Duplicate lifecycle handling and ad-hoc input cadence patterns.

This is exactly what vNext must prevent by construction.

### 1.6 Docs + Release Surfaces

Current docs still primarily teach mixed shell+hook model.  
Architecture docs still describe bridge mode details as normal path instead of explicit platform runtime internals.

Need a single canonical narrative:

1. Headless core runtime.
2. Platform-owned persistent arcade session.
3. Optional UI package with zero lifecycle ownership.

## 2) Target Rewrite Shape (Clean Boundaries)

### 2.1 Contract Layer (Single Source of Truth)

Create explicit protocol/contract module (`v2`) consumed by SDK + server + platform runtime.

Must include:

1. Versioned handshake contract (`sdkVersion`, `protocolVersion`, `runtimeKind`).
2. Parent-child bridge contract (`BOOTSTRAP`, `STATE_PATCH`, etc.).
3. Validation schemas per message.
4. Strict separation of transport-neutral messages from transport-specific event names.

Hard rule:

1. No deprecated/proxy contracts in the v2 contract file.

### 2.2 SDK vNext (Headless Core First)

Core package responsibilities:

1. Session lifecycle primitives only.
2. Input ingestion/consumption.
3. State/signal APIs.
4. Transport abstraction.
5. Zero rendered UI.

Public shape (conceptual):

1. `HostSessionProvider`
2. `ControllerSessionProvider`
3. Granular hooks (`usePlayers`, `useRoom`, `useGetInput`, `useInputWriter`, `useSendSignal`, etc.)

Hard rule:

1. Core cannot import SDK UI components or theme classes.

### 2.3 Optional UI Package

`@air-jam/ui` (or `@air-jam/sdk/ui`) should be strictly presentational:

1. Receives data + callbacks as props.
2. Never initializes sockets/sessions.
3. Never implicitly mutates global runtime state.

Hard rule:

1. No hook calls inside UI components that create/own lifecycle.

### 2.4 Server vNext (Gateway + Domain Split)

Refactor server into clear modules:

1. Gateway: parse/validate socket events and map to use-cases.
2. Domain: room/session state machine and invariants.
3. Policies: auth, rate-limit, authorization guards.
4. Broadcast/router: deterministic fanout rules by focus/runtime.

Hard rule:

1. Every state transition is explicit and validated in domain layer.

### 2.5 Platform Runtime (`arcade-runtime`)

Platform owns persistent arcade room/session entirely:

1. Create room once.
2. Keep controllers connected across game switches.
3. Handle iframe bootstrap and lifecycle.
4. Own persistent navbar/chrome outside game iframe.

Game iframes become pure runtime clients through bridge transport.

Hard rule:

1. Embedded games cannot directly create host socket sessions in arcade mode.

### 2.6 Template/CLI vNext

Template should encode only the canonical vNext path:

1. Headless session initialization.
2. Official `useInputWriter` cadence model (no DIY RAF transport as default).
3. Clear standalone vs arcade transport swap.
4. No shell override hacks.

## 3) Hard Deletion List (No Legacy Left Behind)

These should be removed before public launch of vNext:

1. `packages/sdk/src/hooks/use-air-jam-shell.ts`
2. `packages/sdk/src/AirJamClient.ts`
3. Proxy protocol types in `packages/sdk/src/protocol.ts` (`AIRJAM_*` proxy section)
4. Legacy audio APIs in `packages/sdk/src/audio/hooks.tsx` (`AudioProvider`, `useAudioLegacy`)
5. Lifecycle-owning shells in core exports (`HostShell`, `ControllerShell` from root SDK entry)
6. `packages/server/src/index.ts.backup`
7. Platform controller debug ingest call in `apps/platform/src/app/controller/page.tsx`
8. Any docs/template references to mixed shell+hook lifecycle as default path

Pre-release policy:

1. No soft deprecation path needed for the items above; remove and migrate first-party apps directly.

## 4) Refactors Required To Fit vNext Elegantly

### 4.1 SDK Internals

1. Split `protocol.ts` into versioned contract modules.
2. Split monolithic hooks into focused lifecycle modules + focused data hooks.
3. Move env-resolution logic out of core provider into bootstrap helpers.
4. Isolate audio iframe settings sync behind explicit runtime adapter, not module-load listener.
5. Replace networked-store RPC magic with explicit mutation channel contracts (or strictly scoped helper with clear constraints).

### 4.2 Server Internals

1. Extract room aggregate/state machine (`SYSTEM`, `GAME`, launch pending, etc.).
2. Convert event handlers into command handlers with explicit auth/ownership checks.
3. Centralize host/controller authorization checks; never duplicate inline.
4. Keep RoomManager storage simple but behind repository interface for future horizontal scaling.

### 4.3 Platform Internals

1. Replace `useAirJamShell` controller flow with dedicated platform runtime client.
2. Move iframe orchestration into explicit runtime bridge manager with schema validation.
3. Keep dashboard/media UX independent from runtime control plane.
4. Ensure room persistence strategy matches vNext contract (no accidental session resets).

### 4.4 Template + Docs

1. Rewrite docs to one canonical architecture path.
2. Keep “advanced/legacy” content out of starter docs.
3. Ensure scaffolded project mirrors exactly what docs teach.

## 5) Dependency Rules (To Keep Architecture Clean)

1. Contract module is the only shared protocol source for server/sdk/platform runtime.
2. Core SDK cannot depend on React UI components.
3. UI package cannot depend on socket manager/session initialization code.
4. Platform runtime can depend on contracts + transport adapters, but not on SDK shell internals.
5. Template cannot import deprecated/legacy APIs.

## 6) Migration Sequence (Rewrite Program)

### Phase 0: Freeze + Baseline

1. Keep current test suite green as baseline snapshot.
2. Add targeted contract tests for new protocol v2 schemas.

### Phase 1: Contracts v2

1. Introduce versioned contract package/module.
2. Implement schema validation for bridge and socket payloads.

### Phase 2: Server Kernel Refactor

1. Split gateway/domain/policies.
2. Preserve behavior with integration tests.
3. Remove legacy/duplicate event paths as v2 solidifies.

### Phase 3: SDK Headless vNext

1. Implement session providers + granular hooks.
2. Remove lifecycle ownership from UI surfaces.
3. Move UI into dedicated optional package entry.

### Phase 4: Platform Runtime Migration

1. Implement persistent room owner runtime.
2. Switch iframe communication to versioned bridge protocol.
3. Remove `useAirJamShell` usage from platform controller path.

### Phase 5: Template + Example Migration

1. Migrate `create-airjam` template.
2. Migrate `apps/prototype-game`.
3. Migrate reviewed external example apps (`the-office`, `last-band-standing`, `code-review`).

### Phase 6: Legacy Purge

1. Execute hard deletion list.
2. Remove legacy docs/tutorial references.
3. Cut pre-release with only vNext paradigm available.

## 7) Acceptance Gates For “Ultra-Clean” Completion

1. A new scaffolded game has exactly one obvious integration path.
2. No first-party code uses CSS hacks to suppress SDK-owned shell behavior.
3. Platform arcade can switch games without room/controller reconnection churn.
4. SDK core exports contain no UI or legacy bridge APIs.
5. Server event handlers are thin; domain state machine owns transitions.
6. Docs and template match runtime reality with no alternate legacy path.

## 8) Immediate Execution Priorities From This Audit

1. Start with contract v2 definition and event naming freeze.
2. Refactor server into gateway/domain split while behavior is test-protected.
3. Build headless session primitives and migrate platform runtime off SDK shells.
4. Migrate template and first-party games immediately after runtime stabilization.
5. Purge legacy files/exports before article/release to avoid ambiguity leaking to users.
