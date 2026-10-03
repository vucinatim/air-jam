# Arcade Surface Contract

Last updated: 2026-09-12
Status: implemented contract

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
4. full host-shell restoration, because the embedded runtime process is new

Do not increment on:

1. overlay changes
2. transport reconnect while the same host-shell process and surface survive
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
3. live controller outer chrome follows the embedded controller `SurfaceViewport orientation`, with session `controllerOrientation` only as a startup fallback

## Controller Presentation Authority

Live controller presentation is not read from `ArcadeSurfaceState.orientation`
on the client.

The authority chain is:

1. controller UI declares the intended live presentation through
   `SurfaceViewport orientation`
2. SDK controller runtime publishes that orientation to the parent shell with
   the active Arcade surface identity
3. platform controller shell accepts presentation sync only from the active
   controller iframe and matching surface identity
4. server `controllerOrientation` remains only a session-backed startup
   fallback, not the primary controller chrome authority

So:

1. `ArcadeSurfaceState.orientation` is a launch-time hint
2. embedded controller `SurfaceViewport orientation` is the live chrome truth
3. stale or mismatched controller iframes must not override the current outer
   shell presentation

### Platform Behavior

When the controller page shows an embedded game, the outer shell should use:

1. the embedded controller `SurfaceViewport orientation` for notch placement
   and safe-area padding
2. `controller.controllerOrientation` only as the initial fallback before the
   embedded controller frame has published
3. never the Arcade store `orientation` field as the live phase-specific source

When no game iframe is shown, the outer shell stays portrait.

### Game Integration

Games configure controller presentation by wrapping the controller root in
`SurfaceViewport` and passing the live desired `orientation`.

In Arcade embedded runs, that same component also tells the parent controller
chrome which orientation to use.

Hosts should not call `sendState({ orientation })` just to rotate controller
chrome. Host state should only carry gameplay or runtime metadata that truly
belongs to the host session.

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
3. child launch capability continuity
4. retain the last observed Arcade surface epoch and replicated revision as a
   monotonic reconnect checkpoint

The checkpoint is counter continuity, not a second semantic surface snapshot.
On full host-shell reconnect,
`HostRegistrationAck.arcadeSurfaceCheckpoint` carries the checkpoint. The
fresh shell derives browser/game meaning from the typed session and route,
creates a new epoch above the checkpoint, and publishes at a revision above
the checkpoint. The cached `arcade.surface` payload is not replayed into the
host.

## Parallel Store Rule

Arcade uses two legitimate replicated domains in one room:

1. the persistent Arcade shell domain
2. the active embedded game domain

Rules:

1. shell state stays live across browser/game switches
2. embedded game state is scoped to the current surface instance
3. game store domain is resolved automatically by SDK/runtime
4. game/app code keeps normal `createAirJamStore(...)` usage

## Menu Command Ownership

Menu gestures do not use gameplay `controller:input`. They use the existing
`controller:action_rpc` route with `storeDomain: "arcade.surface"`:

| Action                   | Payload                                                     | Meaning                         |
| ------------------------ | ----------------------------------------------------------- | ------------------------------- |
| `airjam.arcade.navigate` | `{ epoch, direction: "up" \| "down" \| "left" \| "right" }` | Move the browser selection once |
| `airjam.arcade.confirm`  | `{ epoch }`                                                 | Launch the selected game once   |

The SDK protocol exports the action names and strict payload schemas. The
server authenticates the controller and routes the `airjam.arcade.*` namespace
to the master shell, even when an embedded game is active. The shell accepts
these menu commands only from a current player on the matching browser epoch,
outside an active launch; confirmation also observes the exit cooldown and
validates the selected catalog index. Preview mode does not accept menu
navigation.

The controller emits one command per gesture, not a periodic input stream.
Directional activation retains the `0.5` threshold and vertical priority;
returning to neutral allows another move. Confirm requires a new press after
release. Removing the remote during a surface/connection change discards its
held gesture without replaying it. Failed launches wait for an explicit retry.

Host-local selection and launch admission advance synchronously through the
same reducer, so commands arriving before React renders cannot launch an old
selection or start duplicate concurrent launches. Delayed menu commands cannot
reach game input schemas or act on a later browser epoch. Game inputs and
game-defined actions keep their existing APIs.

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
