# Arcade Surface Contract

Last updated: 2026-03-25  
Status: draft, implementation-target

## Purpose

This document defines the canonical replayable state contract that keeps:

1. Arcade host UI
2. controller outer shell
3. embedded host/controller runtimes

aligned on the same active surface.

This contract exists to replace transient UI pulses and split local authority.

## Core Decision

The active Arcade/controller surface is app state, not transport state.

So the canonical owner is:

1. Arcade host replicated state

It does not live primarily in:

1. server room session
2. controller page local state
3. bridge attach state
4. generic shared connection store

Those layers may cache or forward it, but they do not own it.

## Canonical State Shape

```ts
type ArcadeSurfaceKind = "browser" | "game";

type ArcadeOverlayKind = "hidden" | "menu" | "qr";

interface ArcadeSurfaceState {
  epoch: number;
  kind: ArcadeSurfaceKind;
  gameId: string | null;
  controllerUrl: string | null;
  orientation: "portrait" | "landscape";
  overlay: ArcadeOverlayKind;
}
```

## Field Semantics

### `epoch`

Monotonic integer incremented every time the active surface instance changes.

Used for:

1. rejecting stale embedded runtimes
2. making browser/game transitions deterministic across reconnect
3. ensuring old iframes cannot continue talking after a switch

### `kind`

The current outer surface the Arcade system is presenting.

Values:

1. `browser`
2. `game`

This is the primary field both host Arcade and controller shell render from.

### `gameId`

The currently active game identifier.

Rules:

1. `null` when `kind === "browser"`
2. required when `kind === "game"`

### `controllerUrl`

The normalized controller runtime URL for the active game.

Rules:

1. `null` when `kind === "browser"`
2. required when `kind === "game"`
3. must already be normalized and valid before entering the state

### `orientation`

Launch-time hint for the active surface (replication, catalog, host UX). It is **not** the live source of truth for controller outer chrome.

**Live controller notch / safe-area / shell layout** on the platform controller page follows **`controllerOrientation` in the server session**, broadcast via `server:state` from the host (`host:state`). The SDK exposes this as `useAirJamController().controllerOrientation`. See [Platform Controller Presentation](./platform-controller-presentation.md).

Rules:

1. `portrait` by default for Arcade browser
2. for game surfaces, may be set when entering the surface (e.g. catalog default); runtime presentation still converges on host-reported orientation

### `overlay`

Platform overlay state, owned by Arcade app state.

Values:

1. `hidden`
2. `menu`
3. `qr`

Rules:

1. this is platform state, not embedded game state
2. it should be replayable on reconnect if we want reconnect to preserve it
3. if preserving overlay across reconnect feels too heavy, we can still own it here and intentionally reset it on reconnect with an explicit policy

## Canonical Examples

### Browser Idle

```ts
{
  epoch: 1,
  kind: "browser",
  gameId: null,
  controllerUrl: null,
  orientation: "portrait",
  overlay: "hidden",
}
```

### Browser With QR Open

```ts
{
  epoch: 1,
  kind: "browser",
  gameId: null,
  controllerUrl: null,
  orientation: "portrait",
  overlay: "qr",
}
```

### Game Active

```ts
{
  epoch: 2,
  kind: "game",
  gameId: "pong",
  controllerUrl: "https://example.com/pong/controller",
  orientation: "landscape",
  overlay: "hidden",
}
```

### Return From Game To Browser

```ts
{
  epoch: 3,
  kind: "browser",
  gameId: null,
  controllerUrl: null,
  orientation: "portrait",
  overlay: "hidden",
}
```

## Ownership Rules

### Arcade Host Store

Owns the canonical `ArcadeSurfaceState`.

Responsibilities:

1. setting browser surface
2. setting game surface
3. incrementing `epoch`
4. changing overlay state
5. broadcasting this state through the normal replicated state lane

### Controller Outer Shell

Does not own surface truth.

Responsibilities:

1. subscribe to replicated surface state
2. render browser controls when `kind === "browser"`
3. render embedded controller iframe when `kind === "game"`
4. use server-backed `controllerOrientation` (SDK) for outer notch / safe-area when `kind === "game"`; use surface `orientation` only as non-authoritative launch metadata
5. use `epoch` to reject stale attached iframe sessions

### Embedded Game Runtimes

Do not own outer Arcade surface truth.

Responsibilities:

1. attach against the current `epoch`
2. accept being invalidated when `epoch` changes
3. own game-local state only

### Server

Does not own `ArcadeSurfaceState`.

Responsibilities:

1. keep room membership / focus / join token / host authorization valid
2. optionally validate runtime epoch inputs if they are passed through attach flows
3. route traffic correctly

## Where This State Should Live

Recommended location:

1. a dedicated Arcade replicated store in the platform app

Why:

1. this state is Arcade app state
2. it needs host ownership and replay on reconnect
3. it should not contaminate the generic shared connection store
4. it should not be partially mirrored into server room fields as app-level truth

Not recommended:

1. putting `ArcadeSurfaceState` into `RoomSession`
2. storing it only in `useArcadeRuntimeManager`
3. storing it only in controller page local state
4. stuffing it into the generic SDK connection store as the long-term home

## Epoch Rules

`epoch` increments on every surface instance change.

### Increment Required

1. browser -> game
2. game -> browser
3. game A -> game B

### Increment Not Required

1. overlay changes within the same surface instance
2. controller reconnect while the same surface remains active
3. host reconnect while restoring the same surface instance

### Notes

Overlay changes are not new runtime instances. They are state changes within the same surface.

## Runtime / Bridge Contract Additions

Host/controller embedded runtime bootstrap and attach should include:

```ts
interface ArcadeSurfaceRuntimeIdentity {
  epoch: number;
  kind: "browser" | "game";
  gameId: string | null;
}
```

Minimum rule:

1. if a bridge request or attach targets an older `epoch`, reject it

Recommended rule:

1. bootstrap/attach includes enough identity to assert that the runtime belongs to the current active surface

## Mapping From Current Code

### Former field: `useArcadeRuntimeManager.view` (removed)

Was duplicated with `ArcadeSurfaceState.kind`. The runtime reducer no longer stores a `view`; use `ArcadeSurfaceState.kind` only.

### Current Field: `useArcadeRuntimeManager.activeGameId`

Current location:

1. `apps/platform/src/components/arcade/arcade-runtime-manager.ts`

Future:

1. becomes derived from `ArcadeSurfaceState.gameId`

### Current Field: `useArcadeRuntimeManager.normalizedGameUrl`

Current location:

1. `apps/platform/src/components/arcade/arcade-runtime-manager.ts`

Future:

1. becomes derived from `ArcadeSurfaceState.controllerUrl` or paired game host metadata

### Historical Field: server `activeControllerUrl`

Current location:

1. `packages/server/src/types.ts`
2. `packages/server/src/domain/room-session-domain.ts`

Result:

1. removed as an app-level source of truth
2. removed from server room state once reconnect restore switched to `gameId` + `joinToken` and host-side `controllerUrl` derivation

### Current Field: controller page `activeUrl`

Current location:

1. `apps/platform/src/app/controller/page.tsx`

Future:

1. derived from `ArcadeSurfaceState.kind` + `ArcadeSurfaceState.controllerUrl`

### Current Field: local `qrVisible`

Current location:

1. `apps/platform/src/components/arcade/arcade-system.tsx`

Future:

1. derived from `ArcadeSurfaceState.overlay`

## Migration Policy

### Allowed During Migration

1. temporary derivation from the new snapshot into old server/runtime fields while those fields are being removed

### Not Allowed As Final State

1. keeping both local `activeUrl` and snapshot as co-equal truth
2. keeping server `activeControllerUrl` as primary Arcade UI truth
3. relying on missed pulse order for reconnect correctness

## Acceptance Criteria

This contract is ready to implement when:

1. host Arcade can render entirely from it
2. controller shell can render entirely from it
3. bridge attach can validate against it
4. all current overlapping state owners have an explicit migration path

## Implementation status (2026-03-25)

In progress: `ArcadeSurfaceState` and `useArcadeSurfaceStore` (`createAirJamStore`) in `apps/platform/src/components/arcade/`; host updates surface on launch/exit and room session; platform controller outer shell reads `kind` + `controllerUrl` from replicated state.

Host Arcade UI and arcade-mode host input tick use replicated `surface.kind` (not local `view`). Launch applies surface before `completeLaunch`; exit applies `setBrowserSurface` / overlay before clearing runtime state.

`ArcadeSurfaceRuntimeIdentity` is optional on `ControllerBridgeSnapshot` and `HostBridgeSnapshot` in `@air-jam/sdk`; platform passes it on attach when `kind === "game"`. Embedded controller/host bridge clients reject an attach whose `arcadeSurface.epoch` is strictly lower than the last accepted attach epoch (`validateArcadeBridgeAttachEpoch` in the SDK).
