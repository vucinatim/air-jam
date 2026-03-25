# Air Jam Implementation Plan

Last updated: 2026-03-25  
Status: active

Architecture baseline: [Framework Paradigm](./framework-paradigm.md)

This is the single active implementation tracker for the current Air Jam architecture reset.

## Mission

Stabilize Air Jam around one real paradigm:

1. Arcade is an Air Jam app around another Air Jam app.
2. `createAirJamStore` remains the canonical replicated state primitive.
3. The bridge is transport-only.
4. The server owns only hard runtime invariants.
5. Arcade host and controller always derive the active surface from the same replayable snapshot.

## What We Are Fixing

The main architectural problem is not that the foundation is broken.

The real problem is that Arcade state currently leaks across too many authorities:

1. local React state in platform surfaces
2. transient `client:loadUi` / `client:unloadUi` pulses
3. server room lifecycle/focus fields
4. hidden embedded-runtime behavior inside generic SDK hooks
5. bridge attach state that is not strong enough to reject stale runtimes

This creates drift and reconnect bugs because "what UI should be active?" is not modeled as one replayable fact.

## High-Level Current Read

### What Is Good

1. lane separation is already real in the framework
2. `createAirJamStore` is a strong primitive
3. server room/focus/join-token invariants are useful
4. host/controller bridges are a good transport mechanism

### What Is Muddy

1. Arcade outer surface state is not a canonical replicated state domain yet
2. controller page still depends on transient UI pulses
3. generic host/controller hooks still infer embedded runtime mode from URL params
4. platform commands and platform input are not expressed through one clean ownership model
5. bridge snapshots do not yet carry a strong surface identity / epoch

## Target Outcome

The architecture is considered correct when:

1. Arcade browser and controller always agree on the active surface after reconnect
2. a controller joining mid-session renders the correct browser/game surface from snapshot alone
3. stale embedded host/controller iframes cannot remain attached after a surface switch
4. Arcade is implemented from normal Air Jam primitives, not from a second special paradigm
5. generic SDK hooks stay simple and standalone by default

## Non-Negotiable Rules

1. One owner per fact.
2. If the state matters after reconnect, it must exist in a replayable snapshot.
3. The bridge may adapt transport, but it may not become the owner of Arcade UI semantics.
4. The server may enforce invariants, but it may not become the owner of app-level Arcade UI state.
5. No hidden arcade-mode inference should remain in generic hooks long-term.

## Canonical Ownership Model

### 1. Server Owns

The server owns:

1. room membership
2. controller identity
3. master-host / child-host authorization
4. focus / routing target
5. join tokens and attach validity
6. reconnect continuity
7. runtime epoch validation inputs when needed

The server does not own:

1. Arcade browser selection
2. Arcade overlay/menu presentation
3. active controller surface as an app-level UI concept

### 2. Arcade Host Store Owns

Arcade host replicated state should own a canonical surface domain such as:

1. `surface.kind`: `browser | game`
2. `surface.gameId`
3. `surface.controllerUrl`
4. `surface.orientation`
5. `surface.overlay`
6. `surface.epoch`

This store becomes the source of truth for:

1. host Arcade rendering
2. controller outer shell rendering
3. bridge bootstrap identity

### 3. Embedded Game Owns

The embedded game store owns only game-local state:

1. lobby/readiness
2. scores
3. teams
4. match phase
5. gameplay controller UI

### 4. Bridge Owns

The bridge owns:

1. runtime handshake
2. capability/version validation
3. transport forwarding
4. stale runtime rejection using epoch/surface identity

The bridge must not own:

1. browser vs game UI decisions
2. Arcade menu state
3. platform lifecycle semantics beyond attach/detach validity

## Workstreams

## Phase 1. Ownership Audit

Goal: produce an exact map of where each important fact currently lives.

### Tasks

- [x] Audit Arcade host state in `apps/platform/src/components/arcade`.
- [x] Audit controller outer-shell state in `apps/platform/src/app/controller`.
- [x] Audit server-owned room/session fields in `packages/server/src`.
- [x] Audit embedded runtime inference in generic hooks under `packages/sdk/src/hooks/internal`.
- [x] Audit bridge attach snapshots and handshake fields in `packages/sdk/src/runtime`.

### Deliverable

A short written ownership map that answers:

1. where the fact lives now
2. where it should live
3. whether the current owner is correct or wrong

### Exit Criteria

- [x] Every important Arcade/controller sync fact has exactly one intended future owner.

### Audit Findings (2026-03-25)

#### Finding 1. Active controller surface is split across three authorities

Current owners:

1. server room field `activeControllerUrl` in `packages/server/src/types.ts` and `packages/server/src/domain/room-session-domain.ts`
2. controller page local `activeUrl` state in `apps/platform/src/app/controller/page.tsx`
3. host Arcade runtime manager state (`view`, `activeGameId`, `normalizedGameUrl`, `joinToken`) in `apps/platform/src/components/arcade/arcade-runtime-manager.ts`

Target owner:

1. Arcade host replicated surface snapshot

Verdict:

This is the main drift bug. The current model represents the same fact in multiple incompatible forms and only one of them is replayable.

#### Finding 2. Controller outer shell still depends on transient UI pulses

Current owner:

1. `client:loadUi` / `client:unloadUi` event handling in `apps/platform/src/app/controller/page.tsx`
2. `createAirJamStore` controller action gating also depends on those same pulses in `packages/sdk/src/store/create-air-jam-store.ts`

Target owner:

1. Arcade host replicated surface snapshot

Verdict:

This is architecturally wrong for reconnect-sensitive state. A pulse is not a source of truth.

#### Finding 3. Arcade host rendering is locally authoritative instead of snapshot-driven

Current owner:

1. `useArcadeRuntimeManager` reducer state in `apps/platform/src/components/arcade/arcade-runtime-manager.ts`
2. local `qrVisible` state in `apps/platform/src/components/arcade/arcade-system.tsx`

Target owner:

1. Arcade host replicated surface snapshot for any state that must survive reconnect or remain in sync with controllers
2. local React state only for purely presentational ephemeral details

Verdict:

The runtime manager is a good UI helper, but it is currently being used as authority for cross-device state.

#### Finding 4. Generic SDK hooks still encode hidden embedded-runtime mode

Current owner:

1. URL-param runtime detection in `packages/sdk/src/runtime/runtime-session-params.ts`
2. hidden branching in `packages/sdk/src/hooks/internal/use-host-runtime-api.ts`
3. hidden branching in `packages/sdk/src/hooks/internal/use-controller-runtime-api.ts`

Target owner:

1. explicit embedded host/controller runtime adapters

Verdict:

This is a direct paradigm leak. It keeps the framework half in standalone mode and half in special Arcade mode.

#### Finding 5. Bridge snapshots are too weak to identify a surface instance

Current owner:

1. `ControllerBridgeSnapshot` in `packages/sdk/src/runtime/controller-bridge.ts`
2. `HostBridgeSnapshot` in `packages/sdk/src/runtime/host-bridge.ts`

Current snapshot gaps:

1. no `surface.kind`
2. no `surface.gameId`
3. no `surface.controllerUrl`
4. no `surface.epoch`

Target owner:

1. bridge attach/bootstrap contracts should carry the active surface identity and epoch

Verdict:

Without surface identity and epoch, the bridge can transport traffic but cannot deterministically reject stale embedded runtimes after a switch.

#### Finding 6. Server room model mixes good invariants with app-level UI hints

Current owner:

1. good invariants: `focus`, `joinToken`, `childHostSocketId`, `lifecycleState`
2. muddy app-level field: `activeControllerUrl`

Target owner:

1. server keeps hard invariants
2. Arcade replicated state owns active surface/UI semantics

Verdict:

The server model is not broadly wrong, but `activeControllerUrl` is the beginning of the ownership leak from app state into runtime state.

#### Finding 7. Platform command model exists, but it is implicit

Current owner:

1. browser navigation via input lane in `apps/platform/src/components/arcade/arcade-system.tsx`
2. QR/exit/menu commands via `airjam.arcade.*` action RPC routing in `packages/server/src/gateway/handlers/register-realtime-handlers.ts`

Target owner:

1. input lane remains for high-frequency browser navigation if desired
2. platform command lane becomes an explicit and documented contract

Verdict:

This is not fundamentally wrong, but it is under-specified and currently feels accidental.

#### Finding 8. Shared connection store has no concept of Arcade surface state

Current owner:

1. generic connection store in `packages/sdk/src/state/connection-store.ts`

Current fields:

1. role/session state
2. players
3. `gameState`
4. `controllerOrientation`
5. `stateMessage`

Missing:

1. active Arcade surface
2. controller game URL
3. surface epoch
4. overlay state

Target owner:

1. dedicated Arcade replicated store or explicit formalized Arcade state slice

Verdict:

There is currently nowhere canonical in the app model for the state we need to keep host Arcade and controller shell aligned.

## Phase 2. Define The Canonical Arcade Surface Contract

Goal: replace transient UI truth with a replayable replicated surface snapshot.

Reference spec: [Arcade Surface Contract](./arcade-surface-contract.md)

### Tasks

- [ ] Define the Arcade surface state shape and name it explicitly.
- [ ] Decide which fields are required for browser/game switching and reconnect replay.
- [ ] Define `surface.epoch` semantics for every surface change.
- [ ] Define how overlay/menu state fits into the same domain.
- [ ] Decide whether this domain lives in a dedicated Arcade store or a thin formalized slice over existing runtime state.

### Deliverable

A concrete contract for the Arcade surface snapshot, with examples for:

1. browser idle
2. game active
3. switching game A -> game B
4. returning from game -> browser

### Exit Criteria

- [ ] Host Arcade UI and controller outer shell can both be implemented from the same contract.

### Contract Decision (2026-03-25)

The concrete target contract now exists in [docs/arcade-surface-contract.md](/Users/timvucina/Desktop/MyProjects/air-jam/docs/arcade-surface-contract.md).

Locked decisions:

1. canonical owner is Arcade host replicated state
2. canonical shape is `ArcadeSurfaceState`
3. `epoch` increments on surface instance changes only
4. controller shell derives active game UI from snapshot, not pulses
5. bridge bootstrap/attach must eventually validate surface identity and epoch

## Phase 3. Make Controller Outer Shell Snapshot-Driven

Goal: controller outer UI must stop depending on transient load/unload pulses.

### Tasks

- [ ] Replace `client:loadUi` / `client:unloadUi` as primary truth for controller page rendering.
- [ ] Derive controller outer surface from the canonical Arcade surface snapshot.
- [ ] Keep browser navigation/input enabled only when the snapshot says the browser is active.
- [ ] Ensure reconnect/join replay uses snapshot only.

### Exit Criteria

- [ ] Controller reconnect during browser renders browser correctly without relying on missed pulses.
- [ ] Controller reconnect during game renders game correctly without relying on missed pulses.

## Phase 4. Make Host Arcade Snapshot-Driven

Goal: the host Arcade surface must derive from the same authoritative app state as the controller.

### Tasks

- [ ] Stop treating local runtime manager state as the only truth for active surface.
- [ ] Align launch/close transitions with the canonical Arcade surface contract.
- [ ] Keep local UI helpers only as derived/presentational state, not authority.
- [ ] Ensure host refresh/reconnect can restore the correct surface deterministically.

### Exit Criteria

- [ ] Host Arcade and controller shell cannot drift on browser/game state after reconnect.

## Phase 5. Harden Embedded Runtime Epochs

Goal: stale iframes must not remain logically attached after a surface switch.

### Tasks

- [ ] Add `surface.epoch` to host/controller embedded runtime bootstrap.
- [ ] Add epoch validation to bridge attach and runtime requests.
- [ ] Reject stale bridge handshakes when the active surface has changed.
- [ ] Ensure browser -> game -> browser and game A -> game B switches invalidate old runtimes cleanly.

### Exit Criteria

- [ ] Stale embedded host/controller runtimes cannot continue sending or receiving traffic after a switch.

## Phase 6. Pull Hidden Arcade Logic Out Of Generic Hooks

Goal: generic hooks should not silently become embedded runtime hooks because of URL params.

### Tasks

- [ ] Audit `useAirJamHost` hidden embedded-runtime behavior.
- [ ] Audit `useAirJamController` hidden embedded-runtime behavior.
- [ ] Introduce explicit embedded host/controller runtime adapters.
- [ ] Keep standalone APIs simple and default.
- [ ] Move URL-param detection behind explicit adapter boundaries over time.

### Exit Criteria

- [ ] Generic hooks describe one obvious default runtime model.
- [ ] Embedded runtime behavior exists behind explicit adapter contracts.

## Phase 7. Server Invariant Minimization

Goal: keep the server authoritative only where that authority is actually needed.

### Tasks

- [ ] Review every Arcade-related field in `RoomSession`.
- [ ] Keep focus, membership, join token, and lifecycle invariants.
- [ ] Remove or demote app-level UI ownership assumptions that belong in Arcade replicated state instead.
- [ ] Define the minimum server contract needed for attach validity and routing.

### Exit Criteria

- [ ] Server room state reflects runtime invariants, not partial app UI truth.

## Phase 8. Command And Input Cleanup

Goal: platform intent should be explicit and coherent.

### Tasks

- [ ] Review `airjam.arcade.*` command usage and formalize the allowed platform command set.
- [ ] Keep per-frame browser navigation on input lane if it remains useful.
- [ ] Ensure platform commands are coarse and explicit.
- [ ] Eliminate accidental mixing of gameplay semantics and platform semantics.

### Exit Criteria

- [ ] Platform commands have a clean contract and obvious ownership model.

## Validation Plan

The architecture is not done until these behaviors are covered.

### Required Runtime Tests

- [ ] controller reconnect while Arcade browser is active
- [ ] controller reconnect while game is active
- [ ] host Arcade reconnect while controllers stay connected
- [ ] game A -> game B switch without stale controller/host runtime drift
- [ ] game -> browser return without stale iframe traffic
- [ ] stale embedded runtime rejected by epoch mismatch

### Required Quality Gates

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] targeted SDK runtime tests
- [ ] targeted server routing/lifecycle tests
- [ ] platform behavior coverage for browser/game switching and reconnect

## Out Of Scope For This Plan

These are not part of the current architecture reset unless they block the work:

1. new gameplay features
2. visual redesign unrelated to ownership/sync
3. broad SDK API redesign outside runtime boundary cleanup
4. replacing Zustand or the current replicated store primitive

## Recommended Execution Order

1. finish ownership audit
2. define Arcade surface contract
3. make controller shell snapshot-driven
4. make host Arcade snapshot-driven
5. add epoch to bridge/runtime contracts
6. clean generic hook boundaries
7. minimize server ownership
8. lock tests and remove old transient truth paths

## Current Recommendation

Do not start by editing the server again.

Start with the ownership audit and the Arcade surface contract.

If we get those two right, the rest becomes a disciplined migration.
If we skip them, we will keep patching symptoms inside a muddy model.
