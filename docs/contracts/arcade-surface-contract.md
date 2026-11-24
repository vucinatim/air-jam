# Arcade Surface Contract

Last updated: 2026-11-24
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

1. the room
2. controller page local state
3. the room bridge serving a frame
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

The stable identity of one showing of one surface. It is the field every
frame, request and menu command names to prove it belongs to what is showing
now.

Increment on:

1. browser -> game
2. game -> browser
3. game A -> game B

Do not increment on:

1. overlay changes
2. a reconnect of the shell or a phone
3. a reload of the Arcade shell: the shell takes `arcade.surface` back from
   the room's copy with the same `epoch`, so the game that was showing keeps
   showing
4. a new frame for the same surface, which replaces the old one

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
4. the room's presentation channel (`controllerOrientation`) remains only a
   startup fallback, not the primary controller chrome authority

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

Games wrap the controller root in `SurfaceViewport`. Non-joystick games may pass a phase-specific `orientation`.

A game whose `inputModalities` include `'joystick'` always gets a landscape controller; the SDK applies it, so do not set orientation; lay it out with `GamepadLayout` from `@air-jam/sdk/ui`: the stick under the left thumb, the actions under the right in a square the same size, and only short status between them.

In Arcade embedded runs, that same component also tells the parent controller
chrome which orientation to use.

The game runtime publishes its declared orientation in its presentation
channel; launch and system resets preserve that value until the next game
declares its own.

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
3. use `epoch` and surface identity to refuse stale bridge requests

### Embedded Game Runtime

Does not own shell truth.

Responsibilities:

1. ask for its room with the current surface identity
2. own only game-local state
3. accept being closed when `epoch` changes

### Room

Does not own `ArcadeSurfaceState`; it keeps the latest copy of the shell's
`arcade.surface` channel like any channel.

Responsibilities:

1. seats, input and requests
2. keeping each channel's copy, so a returning phone or a reloaded shell is
   served from it

A reloaded shell takes its channels back from the room's copies when their
shape fingerprint matches, `arcade.surface` included; there is no separate
checkpoint. A copy whose shape does not match is discarded and the shell
starts from the browser at a new `epoch`.

## Parallel Store Rule

Arcade uses two legitimate replicated domains in one room:

1. the persistent Arcade shell domain
2. the active embedded game domain, `aj.embedded.game:<gameId>`

Rules:

1. shell state stays live across browser/game switches
2. the game domain names the game, not the `epoch`, so after a shell reload a
   game takes its state back when its shape fingerprint matches
3. the shell drops a game's channels only when leaving that game
4. game store domain is resolved automatically by SDK/runtime
5. game/app code keeps normal `createAirJamStore(...)` usage

## Menu Command Ownership

Menu gestures do not use gameplay input. They are requests on the shell's
`arcade.surface` channel:

| Action                   | Payload                                                     | Meaning                         |
| ------------------------ | ----------------------------------------------------------- | ------------------------------- |
| `airjam.arcade.navigate` | `{ epoch, direction: "up" \| "down" \| "left" \| "right" }` | Move the browser selection once |
| `airjam.arcade.confirm`  | `{ epoch }`                                                 | Launch the selected game once   |

The SDK protocol exports the action names and strict payload schemas. The room
stamps each request with the phone's seat and delivers it to the shell, the
room's only host; a game frame never sees the `arcade.*` channels, even while
it shows. Leaving a game is a request on the same channel. The shell accepts
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

An embedded game or controller page never opens a room of its own. It posts
`AIRJAM_ROOM_BRIDGE_REQUEST` to its parent frame at the topology's
`embedParentOrigin`, never to `"*"`, with its role, its surface identity and a
`MessagePort`. A runtime whose topology declares no parent sends no request
and reports `parent_origin_missing`.

Required surface identity on every request:

1. `epoch`
2. `kind`
3. `gameId`

The parent serves a matching request a scoped view of its own session over
the port (`serveRoomPort` with `createScopedHostConnector` or
`createScopedPhoneConnector`), and refuses any other. That identity is used
to:

1. refuse stale frames
2. close a frame's view when the surface changes
3. keep old iframes from surviving a surface switch

A frame's view covers only its own channels; a frame that reaches outside it
is closed `unauthorised`, and the shell's session is unaffected. A new frame
for the same surface replaces the old one, which closes as `replaced`.

## Invariants

The contract is correct when:

1. host and controller shell can replay the same active surface after reconnect
2. a controller joining mid-session renders correctly from snapshot alone
3. browser/game switches invalidate old embedded runtimes deterministically
4. no second authority stores “what surface is active?” in parallel
