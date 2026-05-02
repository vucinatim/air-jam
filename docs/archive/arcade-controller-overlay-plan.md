# Arcade Controller-Driven Overlay Plan

## Goal

Make Arcade host UI least-obtrusive for fullscreen games:

1. Full navbar/chrome only in Arcade browser view.
2. No persistent host chrome while a game iframe is active.
3. In-game system controls are opened from controller notch/droplet.
4. QR + pause + exit flow is controller-driven and deterministic.

## Architecture Principles (Non-Negotiable)

1. A single replayable snapshot (Arcade host-owned replicated state) is the source of truth for scene, overlay, and game pause state; the server enforces hard invariants only (see `docs/framework-paradigm.md`).
2. Platform overlay behavior must never depend on `toggle_pause` semantics.
3. Gameplay input lane and platform command lane remain strictly separate.
4. Controller UI derives from that same snapshot; it does not invent parallel canonical overlay state.
5. Reconnect must converge by snapshot, not by client-local inference.

## UX Contract (Canonical)

### Host

1. `browser` view: show full Arcade navbar (`room`, `players`, `QR button`).
2. `game` view: show no persistent host UI.
3. In `game` view, host overlays appear only when explicitly requested:
   1. `system menu` overlay
   2. `join QR` overlay

### Controller

1. `browser` view: show full Arcade remote UI (game selection controls).
2. `game` view: show only small notch/droplet over game controls.
3. Tapping notch opens system sheet on controller and overlay on host.
4. Closing sheet returns to clean game controls.

## State Machines

## Host Runtime Machine

State is split into two orthogonal domains:

1. Runtime scene: `browser | game`
2. Overlay state: `hidden | menu | qr` (only meaningful when scene=`game`)

Additional guard state:

- `pauseOrigin: "none" | "platform_overlay"`
- `resumeOnOverlayClose: boolean`

Transition rules:

1. `launch_success`:
   - scene -> `game`
   - overlay -> `hidden`
   - `pauseOrigin="none"`, `resumeOnOverlayClose=false`
2. `open_menu` (controller notch / host Esc), only if scene=`game`:
   - overlay -> `menu`
   - if current game state is `playing`: force pause, set `pauseOrigin="platform_overlay"`, `resumeOnOverlayClose=true`
   - if already paused: `resumeOnOverlayClose=false`
3. `show_qr`, only if scene=`game`:
   - overlay -> `qr`
   - apply same pause guard as `open_menu`
4. `close_overlay`, only if scene=`game`:
   - overlay -> `hidden`
   - if `pauseOrigin="platform_overlay"` and `resumeOnOverlayClose=true`: resume game
   - clear pause guard (`pauseOrigin="none"`, `resumeOnOverlayClose=false`)
5. `exit_game`:
   - scene -> `browser`
   - overlay -> `hidden`
   - clear pause guard

Invariants:

1. Overlay cannot be visible when scene=`browser`.
2. Platform overlay never resumes a game that was already paused before overlay opened.
3. Host chrome/navbar never renders in scene=`game`.

## Controller UI Machine

Controller derives high-level context from runtime:

1. `ARCADE_BROWSER` (no active game controller iframe)
2. `GAME_NOTCH` (game active, notch visible, sheet closed)
3. `GAME_SHEET_MENU`
4. `GAME_SHEET_QR`

Transition rules:

1. `active_game_entered` -> `GAME_NOTCH`
2. `active_game_exited` -> `ARCADE_BROWSER`
3. `notch_tap` in `GAME_NOTCH`:
   - emit `open_menu`
   - local -> `GAME_SHEET_MENU`
4. `show_qr_tap` in `GAME_SHEET_MENU`:
   - emit `show_qr`
   - local -> `GAME_SHEET_QR`
5. `back_tap` in `GAME_SHEET_QR`:
   - emit `open_menu`
   - local -> `GAME_SHEET_MENU`
6. `resume_tap` in `GAME_SHEET_MENU` or `GAME_SHEET_QR`:
   - emit `close_overlay`
   - local -> `GAME_NOTCH`
7. `exit_to_arcade_tap`:
   - emit existing `controller:system` `exit`
   - local waits for server/runtime transition then lands in `ARCADE_BROWSER`

Invariants:

1. Notch only exists in game mode.
2. Browser controller never renders notch.
3. System sheet and notch are mutually exclusive.

## Event and Command Contract

Use explicit platform command channel (do not overload gameplay input lane).

Proposed socket events:

1. `controller:platform_command`
2. `server:platform_overlay_state`
3. `server:platform_command_ack`

`controller:platform_command` payload:

```ts
type PlatformCommand =
  | "open_menu"
  | "show_qr"
  | "close_overlay"
  | "pause_game"
  | "resume_game"
  | "exit_game";

interface PlatformCommandPayload {
  roomId: string;
  command: PlatformCommand;
  actorControllerId: string;
  requestId?: string;
  clientTs?: number;
}
```

`server:platform_overlay_state` payload:

```ts
interface PlatformOverlayStatePayload {
  roomId: string;
  scene: "browser" | "game";
  overlay: "hidden" | "menu" | "qr";
  gameState: "playing" | "paused";
  pauseOrigin: "none" | "platform_overlay";
  version: number;
}
```

`server:platform_command_ack` payload:

```ts
interface PlatformCommandAckPayload {
  roomId: string;
  requestId?: string;
  ok: boolean;
  code?:
    | "UNAUTHORIZED"
    | "ROOM_NOT_FOUND"
    | "INVALID_SCENE"
    | "RATE_LIMITED"
    | "NO_OP";
  message?: string;
}
```

Notes:

1. Keep existing `controller:system` commands for lifecycle (`exit`, `toggle_pause`) during migration.
2. Platform overlay flow should use explicit commands only; no `toggle_pause` in new controller UI paths.
3. Prefer `pause_game`/`resume_game` for direct pause actions; reserve auto-pause logic to server transition helpers.

## Ownership and Race Rules

1. Arcade host replicated state is the single source of truth for overlay/scene; the server enforces invariants (auth, routing, epoch), not app-level UI ownership.
2. Controller local sheet state is presentational and reconciles to the same surface snapshot the host uses (transport may still use events like `server:platform_overlay_state` during migration).
3. Last command processed by the Arcade host authority wins; bump `version` / `epoch` and broadcast or replicate the updated snapshot.
4. Commands are idempotent:
   - `open_menu` while already `menu` is a no-op.
   - `show_qr` while already `qr` is a no-op.
   - `close_overlay` while `hidden` is a no-op.
5. Command processing order is server arrival order per room session.
6. Every processed command emits ACK (`ok` or typed rejection).

## Permission Policy

Define and enforce in server domain policy module (not in UI components):

1. Allowed for all connected controllers:
   - `open_menu`
   - `show_qr`
   - `close_overlay`
   - `pause_game`
   - `resume_game`
2. Restricted command:
   - `exit_game`

Recommended default for `exit_game`:

1. Only controller with `ownerControllerId` may execute.
2. If owner absent, first currently connected controller becomes temporary owner.
3. Host keyboard fallback (`Esc`) always bypasses controller ownership.

## Reconnect and Snapshot Semantics

1. On controller join/rejoin, deliver the current surface snapshot (replicated store replay; server may relay during migration).
2. Controller UI derives notch/sheet state from latest snapshot (not local memory).
3. Surface snapshot must be updated after:
   - game launch success
   - game exit
   - overlay transition
   - pause/resume transition
   - ownership change (if applicable)

## Rate Limiting and Debounce Rules

1. Rate-limit `controller:platform_command` per controller:
   - soft target: 8 commands / second
   - reject excess with `RATE_LIMITED` ACK
2. Deduplicate same command if identical command arrives within 120ms window.
3. Keep command handler pure and side-effect minimal; transition helpers own mutation.

## Minimal UI Surface

## Browser (host)

1. Keep/upgrade `ArcadeChrome` (room, players, QR button).
2. No notch needed here.

## Active game (host)

1. Remove persistent `ArcadeChrome`.
2. Render full-screen game iframe.
3. Render overlay layer only when `overlay !== "hidden"`.

## Active game (controller)

1. Keep game controller iframe.
2. Add floating droplet notch above it.
3. Opening notch reveals system sheet:
   - `Show QR`
   - `Resume`
   - `Exit to Arcade`

## Implementation Plan

### Phase 1: Protocol + Server Routing

1. Add protocol types for `controller:platform_command` and `server:platform_overlay_state`.
2. Add command ACK type/event (`server:platform_command_ack`).
3. Add server handler for `controller:platform_command`.
4. Persist overlay/scene in Arcade host replicated state; server stores only invariant fields (not as owner of Arcade UI truth).
5. Implement room-scoped permission policy (`ownerControllerId`, capabilities).
6. Broadcast `server:platform_overlay_state` on every accepted transition and on join/rejoin.
7. Add rate limiting/dedupe in handler boundary.

### Phase 2: Platform Host Runtime

1. Extend `arcade-runtime-manager` with overlay substate and pause guard.
2. Replace any platform pause toggle flows with explicit `pause_game` / `resume_game`.
3. Wire host overlay rendering in `ArcadeSystem`.
4. Keep `ArcadeChrome` visible only in `browser` scene.
5. Remove hover-only `Exit Game` overlay from `GamePlayer` for arcade mode path.

### Phase 3: Platform Controller Runtime

1. Add notch in `apps/platform/src/app/controller/page.tsx` only when game is active.
2. Add controller system sheet UI (menu + QR mode).
3. Emit platform commands from notch/sheet actions.
4. Reconcile local sheet view against `server:platform_overlay_state`.
5. Use command ACKs for optimistic UI rollback/error toast.

### Phase 4: Cleanup

1. Remove obsolete in-game host controls tied to navbar/chrome assumptions.
2. Remove duplicated pause toggles for platform overlay flow.
3. Keep hidden host rescue shortcut (`Esc`) as non-primary fallback.
4. Mark `toggle_pause` as legacy-only path for platform controller runtime.

## Test Plan

1. Unit:
   1. overlay reducer transitions (`hidden/menu/qr`)
   2. pause guard behavior (`resumeOnOverlayClose`)
   3. idempotent command handling
   4. permission decisions (`ownerControllerId` + fallback)
   5. rate limit + dedupe behavior
2. Integration:
   1. controller notch opens host overlay + pauses
   2. close overlay resumes only when platform initiated pause
   3. exit from controller returns to browser and clears overlay state
   4. multiple controllers issuing commands converge to one host state
   5. reconnecting controller receives correct overlay snapshot immediately
   6. explicit pause/resume commands never invert state unexpectedly
3. Manual:
   1. Browser mode shows full chrome
   2. Game mode has zero persistent host chrome
   3. QR is reachable from controller in <= 2 taps

## Acceptance Criteria

1. Active game host view has no persistent navbar/chrome.
2. Controller notch is present only in active game mode.
3. QR overlay can always be opened from controller without host keyboard/mouse.
4. Pause/resume behavior is deterministic and never flips incorrectly due to toggle races.
5. Room/game exit flow remains server-authoritative and unchanged for safety.

## Release Gates (Must Pass)

1. No platform runtime path relies on `toggle_pause`.
2. Server emits overlay snapshot on controller rejoin and state transitions.
3. Command ACK and permission checks are covered by integration tests.
4. No persistent host chrome is visible during active game iframe.
5. Controller notch + sheet flow works across at least two simultaneous controllers.
