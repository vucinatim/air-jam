# Platform Controller Presentation

How the Air Jam **platform** (`apps/platform`) positions **outer controller chrome** (notch / droplet, safe-area padding) when a game runs **inside** the Arcade embedded controller iframe.

## Source of truth

**Live** presentation mode for controllers is **not** read from `ArcadeSurfaceState.orientation` on the client.

| Layer | Role |
|--------|------|
| **Host** | Sends `orientation` in `host:state` when the game’s phase or layout requires a different controller presentation (e.g. portrait lobby vs landscape match). |
| **Server** | Persists it on the room session and broadcasts `server:state` to controllers. |
| **SDK** | `useAirJamController().controllerOrientation` mirrors the latest `server:state` payload. |
| **Platform** | `apps/platform/src/app/controller/page.tsx` derives notch placement and safe-area classes from that SDK field when `kind === "game"` and the embedded iframe is active. |

`ArcadeSurfaceState.orientation` remains a **launch-time hint** (catalog, replication, host UX). See [Arcade Surface Contract](./arcade-surface-contract.md) § `orientation`.

## Platform behavior

When the controller page shows an embedded game (`activeUrl` from replicated arcade surface + `controllerUrl`), outer UI uses:

- **`controller.controllerOrientation`** — host-driven, session-backed — for `ControllerMenuSheet` notch placement (`top` vs `right`) and `env(safe-area-inset-*)` padding.
- **Not** the arcade store’s `orientation` field, so a catalog default such as `landscape` at launch cannot override a host that reports `portrait` during lobby.

When no game iframe is shown (Arcade browser surface or disconnected), the shell stays **portrait** for the outer layout.

## Game integration

Games do not configure the **platform** notch directly. They drive presentation by reporting orientation from the **host** runtime via the existing `host:state` / `sendState({ orientation })` path (see prototype host: phase-based portrait vs landscape).

## Related code

- Platform: `ControllerMenuSheet`, `controller-menu-notch.tsx`, `app/controller/page.tsx`
- Contract: [arcade-surface-contract.md](./arcade-surface-contract.md)
- Overlay UX history: [archive/done/arcade-controller-overlay-plan.md](./archive/done/arcade-controller-overlay-plan.md)
