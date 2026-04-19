# Arcade Architecture Reset Tracker

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

Reference spec: [Arcade Surface Contract](../../systems/arcade-surface-contract.md)

### Tasks

- [x] Define the Arcade surface state shape and name it explicitly.
- [x] Decide which fields are required for browser/game switching and reconnect replay.
- [x] Define `surface.epoch` semantics for every surface change.
- [x] Define how overlay/menu state fits into the same domain.
- [x] Decide whether this domain lives in a dedicated Arcade store or a thin formalized slice over existing runtime state.

### Deliverable

A concrete contract for the Arcade surface snapshot, with examples for:

1. browser idle
2. game active
3. switching game A -> game B
4. returning from game -> browser

### Exit Criteria

- [x] Host Arcade UI and controller outer shell can both be implemented from the same contract.

### Implementation status (2026-03-25)

1. Types live in `apps/platform/src/components/arcade/arcade-surface-types.ts` (`ArcadeSurfaceState` matches the contract doc).
2. Canonical replicated store: `apps/platform/src/components/arcade/arcade-surface-store.ts` (`createAirJamStore`), host-only mutations for surface transitions, `epoch` bump on browser↔game and game↔game.
3. `ArcadeSystem` resets surface on new `roomId`, updates surface on launch success and exit, drives QR overlay from `surface.overlay` instead of local React state.
4. Platform controller (`apps/platform/src/app/controller/page.tsx`) derives embedded game `activeUrl` from replicated surface (`kind === "game"` + `controllerUrl`); `client:loadUi` / `client:unloadUi` are no longer used for controller shell behavior.

Phase 4 progress: redundant `view` field removed from `ArcadeRuntimeState`; shell browser/game is `ArcadeSurfaceState.kind` only. Join token + normalized host URL stay host-local in the runtime reducer (not replicated to controllers by design). Host full reload: `host:reconnect` ack may include `arcadeSession` (`HostArcadeSessionSnapshot`); `use-host-runtime-api` stores it on the host-only `AirJamStore.hostArcadeRestore` seam; `ArcadeSystem` hydrates `ArcadeSurfaceState` + runtime launch state when present, derives `controllerUrl` locally from the game catalog, and skips the default `resetHostSurfaceForMode` for that bind.

### Contract Decision (2026-03-25)

The concrete target contract now exists in [Arcade Surface Contract](../../systems/arcade-surface-contract.md).

Locked decisions:

1. canonical owner is Arcade host replicated state
2. canonical shape is `ArcadeSurfaceState`
3. `epoch` increments on surface instance changes only
4. controller shell derives active game UI from snapshot, not pulses
5. bridge bootstrap/attach must eventually validate surface identity and epoch

## Phase 3. Make Controller Outer Shell Snapshot-Driven

Goal: controller outer UI must stop depending on transient load/unload pulses.

### Tasks

- [x] Replace `client:loadUi` / `client:unloadUi` as primary truth for controller page rendering.
- [x] Derive controller outer surface from the canonical Arcade surface snapshot.
- [x] Keep browser navigation/input enabled only when the snapshot says the browser is active (`surfaceKind === "browser"` + arcade mode guard).
- [x] Add authoritative synced-store snapshot replay on controller join/reconnect so a late-joining controller receives the current `ArcadeSurfaceState` without waiting for a future host mutation (`createAirJamStore` host effect emits current snapshot on mount, socket reconnect, when the player roster key changes, and on `server:controllerJoined` so same-`controllerId` socket replacement replays without a roster-id change).
- [x] Decouple controller store sync lifetime from `client:loadUi` / `client:unloadUi`; controller stores now remain subscribed to replicated state and stale actions are blocked by real socket/bridge lifecycle instead.

### Review Findings (2026-03-25)

Addressed in SDK:

1. Host now pushes a full `host:state_sync` for each networked store when the host hook mounts/reconnects and when `players` membership changes, so new controllers receive the latest snapshot without a host-side mutation.
2. Controller `airjam:state_sync` subscription is no longer removed on `client:unloadUi`; later cleanup removed `gameUiUnloadedRef` entirely and action RPC blocking now relies on real socket/bridge disconnect state instead of legacy load/unload pulses.
3. Same-`controllerId` reconnect: host also flushes `host:state_sync` on every `server:controllerJoined` (the server emits this on each `controller:join`, including when a new socket replaces an existing session for the same id). Covered by `networked-store.behavior.test.ts`.

### Review resolution (2026-03-26)

1. Controller bridge attach replays `snapshot.state` as `server:state` in `controller-realtime-client.ts`; covered by `packages/sdk/tests/controller-bridge-runtime.behavior.test.ts` (“replays snapshot orientation state on attach”).

### Exit Criteria

- [x] Controller reconnect during browser renders browser correctly without relying on missed pulses (manual QA passed 2026-03-26).
- [x] Controller reconnect during game renders game correctly without relying on missed pulses (manual QA passed 2026-03-26).

## Phase 4. Make Host Arcade Snapshot-Driven

Goal: the host Arcade surface must derive from the same authoritative app state as the controller.

### Tasks

- [x] Stop treating local runtime manager state as the only truth for active surface (no duplicate `view`; visibility and host tick use `surfaceKind`; join token and host iframe URL remain in the runtime reducer).
- [x] Align launch/close transitions with the canonical Arcade surface contract (surface lane updates on launch/exit; join/runtime details still local).
- [x] Keep local UI helpers only as derived/presentational state, not authority (shell/game visibility from `ArcadeSurfaceState`; auto-launch uses `surfaceKind === "browser"` in `shouldAutoLaunchGame`; `GamePlayer` gated by `surfaceKind === "game"` plus runtime join/URL; scroll `browserListAtTop` is chrome-only).
- [x] Ensure host refresh/reconnect can restore the correct surface deterministically (`RoomSession.activeGameId`, `HostRegistrationAck.arcadeSession` on `host:reconnect`, and local `controllerUrl` derivation in `ArcadeSystem`).
- [x] Ensure host reconnect restore does not consume and drop a valid server snapshot before required local dependencies are ready; if the game catalog is still loading, the `arcadeSession` must be retained and applied once the game entry is available (`gamesCatalogReady` on `ArcadeSystem`; arcade route mounts `HostSessionProvider` + `ArcadeSystem` during catalog load; hydration skips clear until the catalog is ready).

### Exit Criteria

- [x] Host Arcade and controller shell cannot drift on browser/game state after reconnect (manual QA passed 2026-03-26).
- [x] Host reconnect must not briefly rebroadcast the default browser `ArcadeSurfaceState` before restoring a valid server-provided active game snapshot (implemented 2026-03-26).

### Implementation note (2026-03-26)

Wrong-order `host:state_sync` for the arcade shell domain is suppressed while `AirJamStore.hostArcadeRestore.phase !== "idle"`:

1. `awaiting_ack` while `host:reconnect` is in flight (`use-host-runtime-api`).
2. `pending_restore` after reconnect ack returns an active arcade session and before `ArcadeSystem` finishes hydration (`createAirJamStore` for `storeDomain: arcade.surface` skips host emits while the restore seam is non-idle).

Covered by `packages/sdk/tests/networked-store.behavior.test.ts` (“suppresses arcade.shell host:state_sync while reconnect ack is pending, then emits when cleared”).

## Phase 5. Harden Embedded Runtime Epochs

Goal: stale iframes must not remain logically attached after a surface switch.

### Tasks

- [x] Add `surface.epoch` (and kind / gameId) to host/controller embedded runtime bootstrap (`ArcadeSurfaceRuntimeIdentity` on `HostBridgeSnapshot` / `ControllerBridgeSnapshot`).
- [x] Add epoch validation to bridge attach (embedded controller/host runtimes reject strictly regressive `arcadeSurface.epoch` on attach).
- [x] Forward-path epoch/identity: shell compares attach snapshot to active `ArcadeSurfaceState` before each shell→iframe `BRIDGE_EVENT` forward and closes the port on drift (`bridgeAttachedIdentityRef` on controller page, `hostBridgeAttachedIdentityRef` in `GamePlayer`). Optional future (not required while refs are authoritative): embed `arcadeSurface` on every `BRIDGE_EVENT` payload for defense-in-depth.
- [x] Reject stale bridge handshakes when the active surface has changed (optional `arcadeSurface` on controller/host bridge **request**; platform shell compares to `ArcadeSurfaceState`; URL params `aj_arcade_*` feed embedded runtimes).
- [x] Forward shell→iframe bridge events only while attach-time surface identity still matches active `ArcadeSurfaceState` (`bridgeAttachedIdentityRef` / `hostBridgeAttachedIdentityRef` on platform; close bridge on drift).

### Exit Criteria

- [x] **In code + tests:** attach rejects regressive epochs; forward path closes on identity drift; covered by `packages/sdk/tests/validate-arcade-bridge-attach.test.ts`, `controller-bridge-runtime.behavior.test.ts`, `host-bridge-runtime.behavior.test.ts`, `arcade-bridge-request-surface.test.ts`, and platform iframe URL tests (`arcade-bridge.test.ts`).
- [x] **Manual / full-stack:** confirm no stale traffic in real Arcade after rapid game A↔B and browser↔game switches (complements automated layers above; manual QA passed 2026-03-26).

## Phase 6. Support Parallel Scoped Stores Per Room

Goal: the Arcade shell store and the running game store must be able to sync in parallel within one room without sharing one flat room-wide store channel.

### Tasks

- [x] Define explicit store/domain scoping for `createAirJamStore` sync traffic (`storeDomain` on `HostStateSyncPayload` / `AirJamStateSyncPayload`; `hostStateSyncSchema` on server).
- [x] Define explicit store/domain scoping for `createAirJamStore` action RPC traffic (`storeDomain` on `ControllerActionRpcPayload` / `AirJamActionRpcPayload`; host + controller filter by domain).
- [x] Support multiple concurrent replicated store domains within one room (protocol + filtering; default domain `AIR_JAM_DEFAULT_STORE_DOMAIN`, arcade shell `AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN`).
- [x] Keep the Arcade shell store always active as its own persistent domain (`arcade-surface-store.ts` uses `storeDomain: arcade.surface`).
- [x] Bind the running game store domain to the active surface identity / `surface.epoch` (implicit domain `aj.embedded.game:{epoch}:{gameId}` / browser variant in `arcade-runtime-url.ts`).
- [x] SDK implicit store-domain resolution: explicit `options.storeDomain` wins; else `aj_store_domain`, else derive from `aj_arcade_*` (`resolveImplicitReplicatedStoreDomainFromWindow` in `create-air-jam-store.ts`).
- [x] Pass embedded game store domain via `aj_store_domain` + `arcadeSurfaceRuntimeUrlParams` (same derivation as implicit resolver).
- [x] Embedded games use plain `createAirJamStore(...)` without app-level Arcade domain helpers; URL parsing stays inside SDK (`arcade-runtime-url.ts`).
- [x] Explicit `storeDomain` reserved for platform/framework stores (e.g. `arcade.surface` on `arcade-surface-store.ts`).
- [x] No game-level URL helpers required for store domain in-repo (e.g. prototype-game uses default `createAirJamStore`).
- [x] Keep input focus singular when multiple store domains sync (documented on `InputManager`: one lane per host provider; `server:input` only).
- [x] Define migration from the current unscoped room-wide `airjam:state_sync` / `airjam:action_rpc` model (breaking: all payloads now require `storeDomain`).

### Exit Criteria

- [x] Arcade shell store and running game store can coexist in one room without state or action collisions (each `createAirJamStore` instance ignores sync/RPC for other domains).
- [x] Embedded game runtime traffic is scoped to its own domain rather than implicitly sharing the shell channel (`default` vs `arcade.surface`; controller iframe no longer applies shell sync to the game store).
- [x] Existing games can use `createAirJamStore(...)` without Arcade-specific domain helpers; resolution is SDK URL/bootstrap driven.
- [x] Embedded games without explicit `storeDomain` bind via implicit domain (`aj_store_domain` / `aj_arcade_*`).

## Phase 7. Pull Hidden Arcade Logic Out Of Generic Hooks

Goal: generic hooks should not silently become embedded runtime hooks because of URL params.

### Tasks

- [x] Audit `useAirJamHost` / `useAirJamController` embedded behavior (module JSDoc: standalone vs embedded; see hook files).
- [x] Introduce explicit embedded host/controller runtime adapters (`embedded-runtime-adapters.ts`: `readEmbeddedHostChildSession`, `readEmbeddedControllerChildSession`).
- [x] Standalone remains default; embedded path uses adapters from `use-host-runtime-api` / `use-controller-runtime-api`.
- [x] URL/bootstrap parsing for embedded sessions centralized in adapters + `runtime-session-params` re-exports.

### Exit Criteria

- [x] Generic hooks document one default (standalone) vs embedded (adapter-resolved) model.
- [x] Embedded bootstrap contracts live in `embedded-runtime-adapters.ts` and `arcade-runtime-url.ts`.

## Phase 8. Server Invariant Minimization

Goal: keep the server authoritative only where that authority is actually needed.

### Tasks

- [x] Review `RoomSession` arcade-related fields (2026-03-26); the old `activeControllerUrl` field was identified as a server ownership leak and later removed.
- [ ] Keep focus, membership, join token, and lifecycle invariants (ongoing).
- [x] Remove `activeControllerUrl` and shrink reconnect/session restore so host derives `controllerUrl` locally from catalog/runtime metadata instead of from a server-owned UI URL field.
- [ ] Define minimum attach contract in a dedicated doc if server surface shrinks further.

### Exit Criteria

- [x] Server room state reflects runtime invariants only; the legacy `activeControllerUrl` field was removed and reconnect snapshots now carry only `gameId` + `joinToken`.

## Implementation Guardrails

These apply to every remaining phase.

### Quality Bar

- [ ] Prefer one explicit owner per fact; if a value is duplicated, one copy must be clearly derived and deletable later.
- [ ] Do not add new Arcade-specific server events or hidden runtime branches when the existing Air Jam lanes can express the behavior cleanly.
- [ ] Keep replay/reconnect guarantees explicit in code, not implicit in effect timing or “usually changes anyway” assumptions.
- [ ] Do not mark plan items complete until the actual guarantee exists in code and is covered by a focused test or manual verification note.
- [ ] Prefer tightening generic primitives like `createAirJamStore` over adding platform-only transport exceptions.

### Remaining Design Follow-Through

- [x] Replace ad hoc replay triggers with a clearly defined reconnect/session-replacement replay trigger that covers same-`controllerId` reconnects, not just player-roster changes (`server:controllerJoined` flush on host; roster key still covers membership-only changes).
- [x] Keep docs aligned with code reality (this plan updated 2026-03-26 to match shipped behavior).
- [ ] Continue collapsing duplicated authority out of host-local Arcade runtime state so `ArcadeSurfaceState` remains the only browser/game surface owner.
- [ ] Treat bridge epoch validation as one layer only; do not use it as a substitute for correct outer-shell state replay.
- [x] Parallel scoped stores per room (`storeDomain` + implicit embedded domains); see Phase 6.

## Phase 9. Command And Input Cleanup

Goal: platform intent should be explicit and coherent.

### Tasks

- [x] Formalize `airjam.arcade.*` platform commands (`protocol/arcade-platform-actions.ts`: `airJamArcadePlatformActions`, `isAirJamArcadePlatformPrefixAction`; server + platform consume shared exports).
- [x] Per-frame browser navigation remains on input lane where `ArcadeSystem` uses it (unchanged architecture).
- [x] Platform commands remain namespaced and coarse (`airjam.arcade.*` → master host routing).
- [ ] Ongoing: avoid new gameplay semantics under `airjam.arcade.*` prefix.

### Exit Criteria

- [x] Platform command strings and master-routing predicate are defined in SDK protocol and reused by server/platform.

## Phase 10. Remove Transitional Compatibility And Dead Paths

Goal: finish the architecture reset completely. The system is not done when the new path exists; it is done only when deprecated, temporary, duplicate, and compatibility-only paths are removed.

### Tasks

- [x] Inventory transitional compatibility (living list — remove as code is deleted):
  1. **Removed on 2026-03-26:** `client:loadUi` / `client:unloadUi`. Outer shell state is snapshot-driven, embedded controller runtimes now rely on bridge/socket lifecycle instead of legacy load/unload pulses, and server/platform/tests no longer use these events in normal flow.
  2. **Removed on 2026-03-26:** `RoomSession.activeControllerUrl`. Reconnect snapshots now carry only `gameId` + `joinToken`, and host restore derives `controllerUrl` locally from the game catalog/runtime URL.
  3. **`sessionStorage` `airjam_room_id`:** host standalone reconnect in `use-host-runtime-api`.
  4. **`hostArcadeRestore`:** host-only reconnect ordering guard. This is transitional only if surface restore can eventually be made synchronous or move behind a narrower host adapter; do not delete as compatibility cleanup by default.
- [x] Record concrete cleanup classification before deleting anything:
  1. **Completed:** `client:loadUi` / `client:unloadUi` were removed after embedded-runtime action gating was switched to real socket/bridge disconnect state and server/platform/tests stopped depending on them.
  2. **Completed:** `RoomSession.activeControllerUrl` was removed after reconnect/session restore was changed to use `gameId` + `joinToken` only and host restore derived `controllerUrl` locally.
  3. **Keep unless separately redesigned:** `hostArcadeRestore`. This is currently a real reconnect-ordering seam, not merely dead compatibility. It should only disappear if reconnect hydration becomes synchronous or moves behind a narrower host-only adapter.
  4. **Out of Arcade cleanup scope unless touched:** `sessionStorage` `airjam_room_id`. This belongs to standalone host reconnect behavior and is not an Arcade-specific compatibility path.
- [x] Define cleanup order so removal does not create new shadow paths:
  1. First remove dead app/game-level Arcade-awareness and obsolete comments/tests.
  2. Then replace embedded-runtime action gating so it no longer depends on `client:loadUi` / `client:unloadUi`.
  3. Then remove legacy load/unload protocol emissions and forwarding.
  4. Then remove `activeControllerUrl` and shrink server reconnect payloads if still possible.
  5. Only after code paths are final, rewrite docs to describe the final architecture with no migration language.
- [x] Re-audit inventory before deleting any of the above end-to-end.
- [x] Remove deprecated protocol/event usage once the final path is verified end-to-end.
- [ ] Remove transitional replay/reconnect shims that are no longer needed after the final authority model is fully in place.
- [ ] Remove duplicate ownership paths where an older field/state/event still shadows the new canonical source of truth.
- [x] Remove any remaining game/app-level Arcade-awareness helpers that were added only to bridge the migration.
- [x] Remove old unscoped assumptions once scoped-store runtime resolution is the only supported model.
- [ ] Remove legacy comments, TODO notes, and “temporary” code branches that no longer serve a live migration purpose.
- [ ] Remove dead tests that only exist for superseded behavior, and replace them with tests that assert the final intended contract.
- [ ] Collapse interim naming that preserves old terminology when the final concept has a clearer canonical name.
- [ ] Update docs so they describe only the final architecture, not a mixture of current behavior and retired transition paths.
- [ ] Review public SDK surfaces for transitional overload or optionality that can now be simplified.
- [ ] Verify that no framework/platform concern is still leaking into app/game code purely for migration convenience.
- [x] Run final manual runtime QA for the highest-risk reconnect/surface flows before removing the last compatibility code.
- [x] Verify host refresh during an active game does not briefly flip controllers back to browser before restore.
- [x] Verify controller reconnect during an active game restores the correct outer shell and embedded game without drift.
- [x] Verify controller reconnect during Arcade browser restores browser state cleanly and does not leave stale embedded runtime attachment behind.

### Exit Criteria

- [ ] There is one obvious code path per concern: one authority path for surface state, one path for scoped replicated stores, one path for embedded runtime attach, one path for reconnect restore.
- [ ] No deprecated or compatibility-only protocol fields/events remain in normal production flow.
- [ ] No app/game code contains Arcade-specific migration logic just to function when embedded.
- [ ] Docs, tests, and runtime code all describe the same final model with no “temporary” caveats left behind.
- [ ] The codebase can be understood without knowing the migration history.
- [x] Final manual reconnect/surface QA passes for host refresh in-game, controller reconnect in-game, and controller reconnect in-browser.

## Phase 11. Framework Boundary Tightening

Goal: reduce future blast radius for framework-level changes by sharpening module ownership and keeping platform-specific concerns out of generic SDK layers wherever possible.

This phase is intentionally limited. It is not a new migration. It exists to consolidate the lessons from this Arcade reset and tighten the highest-leverage boundaries that proved too leaky.

### Tasks

- [ ] Centralize runtime/bootstrap resolution so embedded-vs-standalone decisions are owned in one place instead of spread across hooks, runtime clients, and platform code.
- [ ] Reduce hidden mode inference in generic hooks; prefer explicit runtime adapters over generic hooks implicitly carrying Arcade/platform behavior.
- [ ] Isolate platform Arcade concerns from generic SDK concerns so outer-shell/platform policy lives in platform adapters, not core replicated-store or transport primitives unless truly generic.
- [ ] Review reconnect-specific state ownership and move any remaining Arcade-only reconnect coordination out of generic framework state if a narrower adapter boundary is possible.
- [ ] Consolidate transport/schema ownership so protocol changes touch fewer files and flow through a smaller number of contract modules.
- [ ] Review public SDK exports added during this migration and trim transitional or overly broad exports that increase surface area without serving the final model.
- [ ] Identify any remaining places where app/game code could accidentally become aware of embedding/platform details and close those seams in the framework instead.
- [x] Record any follow-on refactors that are valuable but not required in `suggestions.md` so they do not get lost once the urgent migration work is complete (see **Framework boundary (post–Arcade architecture reset)** in repo root `suggestions.md`).

### Exit Criteria

- [ ] A comparable future change to store scoping, reconnect restore, or embedded runtime bootstrap should be expected to touch meaningfully fewer layers than this migration did.
- [ ] Generic SDK layers have clearer ownership boundaries from platform Arcade adapters.
- [ ] Public framework surfaces are smaller, more explicit, and less migration-shaped.
- [ ] The repo structure more clearly reflects: core protocol/runtime, generic SDK primitives, platform adapters, and app/game code.

## Validation Plan

The architecture is not done until these behaviors are covered.

### Required Runtime Tests

Coverage is **split**: automated tests prove protocol/SDK/platform units; **Arcade UI reconnect** still needs manual passes in the platform app.

| Scenario                                          | Automated (partial)                                                                                                                                               | Manual (Arcade shell)                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Controller reconnect (browser vs in-game surface) | `networked-store.behavior.test.ts` (same-`controllerId` replay, reconnect ack suppression); `controller-bridge-runtime.behavior.test.ts` (attach snapshot replay) | Phase 3 exit criteria (Arcade shell UX) |
| Host reconnect with controllers connected         | `packages/server/tests/room-lifecycle.integration.test.ts` (host reconnect); `stability-churn.integration.test.ts`                                                | Phase 4 exit criteria                   |
| Game A → game B / pause / child host              | `packages/server/tests/game-lifecycle.integration.test.ts` (“keeps controllers connected across game switches…”)                                                  | Drift-free embedded iframes             |
| Game → browser return                             | —                                                                                                                                                                 | Manual                                  |
| Stale runtime / epoch                             | `validate-arcade-bridge-attach.test.ts`, controller/host bridge runtime tests, `arcade-bridge-request-surface.test.ts`                                            | —                                       |

Checklist (keep until manual passes are logged):

- [x] controller reconnect while Arcade browser is active
- [x] controller reconnect while game is active
- [x] host Arcade reconnect while controllers stay connected
- [x] game A -> game B switch without stale controller/host runtime drift
- [x] game -> browser return without stale iframe traffic
- [x] stale embedded runtime rejected by epoch mismatch (automated tests above)

### Required Quality Gates

- [x] `pnpm typecheck` (root script)
- [x] `pnpm lint`
- [x] targeted SDK runtime tests (`pnpm --filter sdk test`)
- [x] targeted server routing/lifecycle tests (`pnpm --filter server test`)
- [x] platform unit tests (`pnpm --filter platform test` — arcade bridge, runtime manager, embedded bridge surface guard)

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
6. support parallel scoped stores per room
7. clean generic hook boundaries
8. minimize server ownership
9. clean command/input ownership
10. remove transitional compatibility and dead paths
11. framework boundary tightening
12. lock final tests and verification

## Current Recommendation (2026-03-25)

Core contract, scoped stores, embedded adapters, reconnect ordering guards, platform command constants, bridge attach + forward drift guards, and quality gates in CI are in place. **Next highest leverage:**

1. **Manual QA** for Phase 3 / 4 / Validation Plan rows that still have empty automated coverage (Arcade reconnect in browser vs in-game, host refresh in-game, game↔browser).
2. **Phase 10** after QA: remove legacy pulses and duplicate paths per inventory re-audit.
3. **Phase 8** optional: shrink server UI-adjacent fields only after end-to-end verification.

The ownership audit and Arcade surface contract are **done**; remaining work is manual verification, Phase 10 cleanup, and optional server field reduction.
