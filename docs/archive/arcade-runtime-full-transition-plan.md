# Arcade Runtime Full Transition + Purge Plan

> **Canonical architecture:** [`docs/framework-paradigm.md`](../framework-paradigm.md) and [`docs/archive/arcade-architecture-reset-summary.md`](./arcade-architecture-reset-summary.md).  
> This file is a **tactical backlog** (file paths, phases, purge list). If anything below conflicts with the framework paradigm—especially **server-owned Arcade UI** or **“separate runtime product”**—**the paradigm wins**.

## Decision

Arcade is a **first-party Air Jam app** built from the same primitives as standalone games: same lanes, same session model, **bridge transport only** where the iframe boundary requires it. It is **not** a second framework or a separate “runtime product” paradigm.

Arcade still has **distinct responsibilities** in product terms:

1. persistent room/session owner (platform host)
2. game launcher/router
3. controller shell for browser + embedded game surfaces
4. platform UX for overlay, QR, pause, exit—owned in **Arcade host replicated state**, not as ad hoc server UI authority

We optimize for **one replayable surface snapshot** shared by host and controller, **deterministic epochs**, and **zero hidden arcade mode** inside generic SDK hooks.

## Non-Negotiable Architecture Rules

1. Standalone and Arcade use the **same** Air Jam contracts; Arcade adds **explicit adapters** and **bridge** where embedded, not a parallel framework.
2. No URL-param auto-mode inference inside core SDK host/controller hooks.
3. No toggle-based pause semantics in platform/system flows.
4. Platform/system command lane stays separate from gameplay input lane.
5. Server owns **hard invariants** (membership, auth, routing/focus, child launch capability, reconnect continuity, epoch validation)—**not** app-level Arcade browser/overlay UI as primary truth.
6. If a path is legacy/duplicate/ambiguous, delete it (no soft deprecation on this branch).

## Target Architecture (Canonical)

## 1) Standalone Runtime (`@air-jam/sdk`)

Use only explicit standalone providers/hooks:

1. `HostSessionProvider` + `useAirJamHost`
2. `ControllerSessionProvider` + `useAirJamController`
3. `useInputWriter`, `useGetInput`, `createAirJamStore`

No implicit arcade child/sub-controller logic in these hooks.

## 2) Arcade Host Runtime (`apps/platform`)

Owns:

1. room creation/reconnect
2. game launch/close
3. browser selection UI
4. overlay state (`hidden|menu|qr`) in active game
5. host pause policy for system overlays

Uses server lifecycle APIs + explicit platform command channel.

## 3) Arcade Controller Runtime (`apps/platform`)

Owns:

1. browser remote UI (when no active game UI)
2. in-game notch + system sheet
3. platform command dispatch (`open_menu`, `show_qr`, `close_overlay`, `pause_game`, `resume_game`, `exit_game`)
4. rendering game controller iframe (optional) as embedded client surface

## 4) Game Runtime in Arcade Iframes

Game host/controller iframes are embedded runtime clients.  
They do not decide platform system UX or lifecycle policy.

## Main Ambiguities / Duplications to Eliminate

1. SDK hooks mixing standalone + arcade by query params.
2. Mixed system command semantics (`toggle_pause` everywhere).
3. Two "close child" concepts (`server:closeChild` vs `child:close`).
4. Arcade UI state spread across controller page + arcade system + server with no single overlay authority.
5. Duplicate/unused protocol surface (`ready`, `host:registerSystem` usage gap, controller runtime kinds unused).
6. Mixed transport assumptions for controller iframe mode (sub-controller path vs controller authorization model).
7. Extra escape UI in host game (`hover exit`) conflicting with controller-first arcade model.

## Refactor Scope by Layer

## A) SDK Purge + Hardening

### A1. Remove hidden arcade mode from core hooks

Refactor:

1. `packages/sdk/src/hooks/use-air-jam-host.ts`
2. `packages/sdk/src/hooks/use-air-jam-controller.ts`

Purge:

1. URL parsing branches for `aj_room`, `aj_cap`, `aj_controller_id`
2. implicit "child mode"/"sub-controller mode" behavior from standalone hooks

Result:

1. hooks are explicit standalone contracts only
2. no hidden runtime switch paths

### A2. Split runtime adapters from core hooks

Add explicit arcade adapters (names can be finalized in implementation):

1. `useArcadeChildHostRuntime` (iframe host path)
2. `useArcadeControllerIframeRuntime` (iframe controller path)

These adapters live in a clear runtime namespace, not inside default host/controller hooks.

### A3. Protocol cleanup in SDK

Refactor:

1. `packages/sdk/src/protocol/controller.ts`
2. `packages/sdk/src/protocol/socket-events.ts`
3. `packages/sdk/src/events.ts`

Purge:

1. `ready` command (if still unused)
2. stale/unused child close naming mismatch
3. unused or duplicate event constants

Add:

1. explicit platform command payload types
2. explicit command ACK types
3. overlay state snapshot types

### A4. Runtime kind cleanup

Refactor:

1. `packages/sdk/src/contracts/v2/handshake.ts`

Purge/Align:

1. runtime kinds that are not implemented in real runtime code
2. keep only implemented kinds or implement the missing paths in this transition

## B) Server Domain Canonicalization

### B1. Invariants vs Arcade UI state

**Canonical model:** scene/overlay/pause guard for the Arcade shell live in **Arcade host replicated state** (see `docs/systems/arcade-surface-contract.md`). The server carries **routing/auth/session invariants** and may mirror or relay snapshots for migration, but must **not** become the long-term owner of app-level Arcade UI truth.

Refactor as needed:

1. `packages/server/src/types.ts`
2. `packages/server/src/domain/room-session-domain.ts`

Where the server still stores transitional fields (for example during migration), treat them as **invariant or transport helpers**, not the final source of truth for overlay UX. Prefer:

1. epoch / join-token style guards
2. explicit platform command ACKs
3. forwarding **surface snapshots** authored by the Arcade host authority

### B2. Add explicit platform command lane

Refactor:

1. `packages/server/src/gateway/handlers/register-controller-handlers.ts`
2. `packages/server/src/protocol` usage layer

Add events:

1. `controller:platform_command`
2. `server:platform_command_ack`
3. `server:platform_overlay_state`

Purge from platform flows:

1. pause/resume via `toggle_pause`

### B3. Deterministic pause transitions

Add explicit semantics:

1. `pause_game`
2. `resume_game`

No platform path uses toggle semantics.

### B4. Permission and abuse controls

Implement domain policy:

1. capability map per command
2. owner fallback policy for restricted commands (`exit_game`)
3. per-controller rate limit + dedupe for platform commands

### B5. Event naming cleanup

Unify child close path:

1. choose one event naming convention and remove the other (`server:closeChild` vs `child:close`)

## C) Platform Arcade Runtime Restructure

### C1. Split orchestration from presentation

Refactor `apps/platform/src/components/arcade/arcade-system.tsx` into:

1. `arcade-orchestrator` (launch/close/session wiring)
2. `arcade-browser-view`
3. `arcade-game-view`
4. `arcade-overlay-layer` (host overlay renderer)

### C2. Host chrome rules

Canonical:

1. browser scene -> full chrome
2. active game scene -> zero persistent chrome

Purge:

1. any in-game persistent host navbar path
2. hover-only host game exit controls in arcade mode

### C3. Controller runtime split

Refactor `apps/platform/src/app/controller/page.tsx` into:

1. `controller-browser-remote-view`
2. `controller-game-shell-view` (notch + sheet + iframe)
3. `controller-platform-command-client`

Purge:

1. mixed header semantics that duplicate browser and game responsibilities

### C4. Overlay state sync

Controller sheet is presentational.  
It reconciles to the **same replayable surface snapshot** as the Arcade host (transport may use `server:platform_overlay_state` or store replication during migration).

## D) Protocol and Transport Simplification

### D1. Canonical command/event set for arcade system UX

Allowed platform commands:

1. `open_menu`
2. `show_qr`
3. `close_overlay`
4. `pause_game`
5. `resume_game`
6. `exit_game`

### D2. Remove ambiguity in runtime payload entrypoints

Purge/replace:

1. ad-hoc runtime behavior hidden in query params for core hooks
2. any duplicate path that provides equivalent behavior with weaker guarantees

## E) Cleanup List (Hard Delete)

Delete when replacement lands:

1. URL-param arcade/sub-controller detection in core SDK hooks
2. platform use of `toggle_pause`
3. unused `ready` command surface (if no surviving usage)
4. duplicate close-child event naming path
5. arcade host hover exit overlay
6. stale logging noise in arcade runtime paths once diagnostics are in place
7. any protocol/runtime kind not backed by real runtime usage

## File-Oriented Work Plan

## Phase 0: Contract Freeze

Edit docs/spec first:

1. `docs/framework-paradigm.md` (canonical)
2. `docs/archive/arcade-controller-overlay-plan.md`
3. this file (tactical backlog)

Freeze:

1. command names
2. ownership policy (host store vs server invariants)
3. pause semantics
4. runtime boundaries

## Phase 1: Protocol + Server

Edit:

1. `packages/sdk/src/protocol/controller.ts`
2. `packages/sdk/src/protocol/socket-events.ts`
3. `packages/sdk/src/events.ts`
4. `packages/server/src/types.ts`
5. `packages/server/src/domain/room-session-domain.ts`
6. `packages/server/src/gateway/handlers/register-controller-handlers.ts`
7. `packages/server/src/gateway/handlers/register-realtime-handlers.ts` (remove platform toggle usage)

Tests:

1. new integration tests for platform commands + ACKs
2. update lifecycle/security tests for explicit pause/resume

## Phase 2: Platform Host Runtime

Edit:

1. `apps/platform/src/components/arcade/arcade-runtime-manager.ts`
2. `apps/platform/src/components/arcade/arcade-system.tsx`
3. `apps/platform/src/components/arcade/game-player.tsx`
4. `apps/platform/src/components/arcade/arcade-chrome.tsx`

Deliver:

1. browser chrome only in browser scene
2. host overlay layer driven by Arcade surface snapshot (same source as controller)

## Phase 3: Platform Controller Runtime

Edit:

1. `apps/platform/src/app/controller/page.tsx`
2. add modular controller runtime components (new files under `app/controller` or `components/arcade-controller`)

Deliver:

1. browser remote view
2. game notch + sheet
3. command dispatch with ACK handling

## Phase 4: SDK Core Purge

Edit:

1. `packages/sdk/src/hooks/use-air-jam-host.ts`
2. `packages/sdk/src/hooks/use-air-jam-controller.ts`
3. runtime adapter additions (new explicit files)

Deliver:

1. standalone hooks are standalone-only
2. arcade runtime behavior moved to explicit adapters

## Phase 5: Final Purge + Docs

Edit:

1. docs pages referencing old command/mode behavior
2. remove unused exports/constants/types
3. update platform docs and agent docs with canonical flow

## Tests and Verification Matrix

## Required automated tests

1. server integration:
   1. platform command ACK success/failure
   2. permission enforcement (`exit_game`)
   3. rate-limit/dedupe behavior
   4. reconnect snapshot correctness
2. platform runtime tests:
   1. overlay reducer + pause guard
   2. notch/sheet state transitions
3. SDK tests:
   1. no hidden arcade inference in standalone hooks
   2. explicit adapter runtime wiring

## Required manual checks

1. Arcade browser:
   1. chrome visible, room/players/QR actions work
2. Active game:
   1. no persistent host chrome
   2. notch opens menu + pauses deterministically
   3. QR shows/hides correctly
3. Multi-controller:
   1. command races converge correctly
4. Exit flow:
   1. controller exit returns to browser and keeps room continuity

## Acceptance Criteria (Release Gate)

1. Arcade system UX is controller-driven in-game, not host-chrome-driven.
2. No platform path relies on `toggle_pause`.
3. Core SDK hooks contain no arcade URL-param branching.
4. Arcade host and controller derive overlay/scene from the **same** replayable surface snapshot; server enforces invariants and may relay, without owning app-level Arcade UI truth.
5. One canonical command/event contract is used by platform and tests.
6. Duplicate/unused protocol/runtime artifacts listed above are removed.

## Out of Scope (for this transition)

1. New gameplay features unrelated to arcade runtime boundaries.
2. Cosmetic visual redesign beyond required runtime UX behavior.
3. Backward compatibility shims for removed ambiguous APIs.

## Implementation Notes

1. Prefer small, explicit modules over one large arcade orchestrator file.
2. Keep all state transitions pure and unit-testable.
3. Keep platform command handling in domain/policy functions, not component event handlers.
4. When in doubt, reduce surface area and delete duplicate paths.
