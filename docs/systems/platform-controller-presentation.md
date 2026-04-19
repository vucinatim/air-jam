# Platform Controller Presentation

How the Air Jam **platform** (`apps/platform`) positions **outer controller chrome** (notch / droplet, safe-area padding) when a game runs **inside** the Arcade embedded controller iframe.

## Source of truth

**Live** presentation mode for controllers is **not** read from `ArcadeSurfaceState.orientation` on the client.

| Layer             | Role                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Controller UI** | Declares the intended live presentation with `SurfaceViewport orientation` (e.g. portrait lobby vs landscape match).                                                     |
| **SDK**           | When a controller runtime is embedded in Arcade, `SurfaceViewport` publishes that orientation to the parent shell with the active Arcade surface identity.               |
| **Platform**      | `apps/platform/src/app/controller/use-controller-embedded-game-frame.ts` accepts presentation sync only from the active controller iframe and matching surface identity. |
| **Server**        | Keeps `controllerOrientation` as session-backed fallback/legacy controller state, but games should not use it as the primary Arcade chrome integration.                  |

`ArcadeSurfaceState.orientation` remains a **launch-time hint** (catalog, replication, host UX). See [Arcade Surface Contract](./arcade-surface-contract.md) § `orientation`.

## Platform behavior

When the controller page shows an embedded game (`activeUrl` from replicated arcade surface + `controllerUrl`), outer UI uses:

- **The embedded controller `SurfaceViewport orientation`** for `ControllerMenuSheet` notch placement (`top` vs `right`) and `env(safe-area-inset-*)` padding.
- **`controller.controllerOrientation`** only as the initial fallback before the embedded controller frame has published.
- **Not** the arcade store’s `orientation` field, so a catalog default such as `landscape` at launch cannot override the controller UI’s live phase-specific layout.

When no game iframe is shown (Arcade browser surface or disconnected), the shell stays **portrait** for the outer layout.

## Game integration

Games configure controller presentation by wrapping the controller root in `SurfaceViewport` and passing the live desired `orientation`. In standalone runs this handles local layout/rotation. In Arcade embedded runs the same component also tells the parent Arcade controller chrome which orientation to use.

Hosts should not call `sendState({ orientation })` just to rotate Arcade controller chrome. Keep host state for gameplay/runtime metadata that truly belongs to the host session.

## Related code

- Platform: `ControllerMenuSheet`, `controller-menu-notch.tsx`, `app/controller/page.tsx`, `app/controller/use-controller-embedded-game-frame.ts`
- SDK: `SurfaceViewport`, `runtime/controller-presentation.ts`, `runtime/controller-bridge.ts`
- Contract: [arcade-surface-contract.md](./arcade-surface-contract.md)
- Overlay UX history: [archive/arcade-controller-overlay-plan.md](../archive/arcade-controller-overlay-plan.md)
