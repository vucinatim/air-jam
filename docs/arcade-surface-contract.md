# Arcade Surface Contract

Last updated: 2026-03-25  
Status: active

## Purpose

This document defines the replayable shell state that keeps:

1. Arcade host UI
2. controller outer shell
3. embedded host/controller runtimes

aligned on the same active surface.

## Canonical Owner

The canonical owner is:

1. the Arcade shell replicated store

It is not owned by:

1. server room session state
2. controller page local state
3. bridge lifecycle state
4. generic shared connection-store state

## State Shape

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

## Field Rules

### `epoch`

Monotonic runtime identity for the current surface instance.

Increment on:

1. browser -> game
2. game -> browser
3. game A -> game B

Do not increment on:

1. overlay changes
2. reconnect to the same surface
3. re-attach to the same surface instance

### `kind`

Primary shell rendering switch:

1. `browser`
2. `game`

### `gameId`

Rules:

1. `null` when `kind === "browser"`
2. required when `kind === "game"`

### `controllerUrl`

Rules:

1. `null` when `kind === "browser"`
2. required when `kind === "game"`
3. must already be normalized and valid before entering the game surface

### `orientation`

Launch-time surface metadata.

Rules:

1. `portrait` for browser
2. game surface may start with catalog/default orientation
3. live controller outer chrome still follows host-reported `controllerOrientation` from `server:state`

### `overlay`

Replayable platform overlay state.

Values:

1. `hidden`
2. `menu`
3. `qr`

## Ownership Rules

### Arcade Shell Store

Owns:

1. browser/game surface
2. `epoch`
3. overlay state
4. active game metadata needed by the shell

### Controller Outer Shell

Derives from the Arcade surface snapshot.

Responsibilities:

1. render browser controls when `kind === "browser"`
2. render embedded controller iframe when `kind === "game"`
3. use `epoch` and surface identity to reject stale bridge sessions

### Embedded Game Runtime

Does not own shell truth.

Responsibilities:

1. attach against the current surface identity
2. own only game-local state
3. accept invalidation when `epoch` changes

### Server

Does not own `ArcadeSurfaceState`.

Responsibilities:

1. room/runtime invariants
2. routing and authorization
3. join token continuity

## Parallel Store Rule

Arcade uses two legitimate replicated domains in one room:

1. the persistent Arcade shell domain
2. the active embedded game domain

Rules:

1. shell state stays live across browser/game switches
2. embedded game state is scoped to the current surface instance
3. game store domain is resolved automatically by SDK/runtime
4. game/app code keeps normal `createAirJamStore(...)` usage

## Bridge Rule

Embedded bridge traffic is surface-bound.

Required on every embedded bridge request and attach:

1. `epoch`
2. `kind`
3. `gameId`

That identity is used to:

1. reject stale attachments
2. close stale forwards after shell drift
3. keep old iframes from surviving a surface switch

## Invariants

The contract is correct when:

1. host and controller shell can replay the same active surface after reconnect
2. a controller joining mid-session renders correctly from snapshot alone
3. browser/game switches invalidate old embedded runtimes deterministically
4. no second authority stores “what surface is active?” in parallel
