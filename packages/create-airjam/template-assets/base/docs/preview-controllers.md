# Preview Controllers

Preview controllers are the fast local desktop tryout path for host surfaces.

They are useful in local development when you want to:

1. verify the controller UI without picking up a phone first
2. test host + controller interplay on one agent
3. mix one desktop preview controller with one real phone/browser controller in the same room

## Product Position

Air Jam is still phone-first.

Preview controllers are not the main product interaction. They are an optional
host-side accessory that speeds up local iteration and public tryout.

## Important Rules

1. preview controllers use the real controller route
2. preview controllers join the same room/session model as phone controllers
3. preview controllers are not a fake simulator or second topology
4. production should stay explicit opt-in

If a game behaves differently under a preview controller, treat that as a sign
the game may be relying on an accidental controller-origin assumption.

## Default Local Dev Usage

Scaffolded host surfaces can mount the shared SDK preview workspace like this:

```tsx
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";

export const HostView = () => {
  const previewControllersEnabled = import.meta.env.DEV;

  return (
    <>
      <GameSurface />
      <HostPreviewControllerWorkspace enabled={previewControllersEnabled} />
    </>
  );
};
```

In the normal local loop:

1. open the host page
2. click `Open controller`
3. a real controller client opens in the host-local preview workspace
4. you can still join the same room from a phone or another browser tab

The preview workspace supports:

1. multiple floating controller windows
2. drag by the title bar
3. resize from any window edge or corner
4. minimize and close controls
5. per-window portrait or landscape rotation from the title bar
6. shared active-opacity control for preview windows through platform settings
7. a room controller roster with source-aware `Kick` controls for manual local recovery
8. a `Reset room` escape hatch that creates a fresh empty room and reloads the local host page so gameplay state and controller state both reset cleanly

`host.players` stays the gameplay-facing list.

`host.controllers` is the richer room-session roster. Use it when you need:

1. controller source (`phone`, `preview`, `virtual`)
2. connected versus disconnected session state
3. resume-lease awareness
4. manual host recovery controls such as removing a stuck controller
5. local-dev recovery flows such as resetting the current room

## Production Rule

Do not mount preview controllers in production by accident.

The safe default is:

1. enabled in local dev
2. disabled in production unless the host intentionally opts in

That keeps phone controllers as the canonical public interaction while still
allowing deliberate product experiments later.

## Where The API Lives

The feature is intentionally not part of the root SDK surface.

Use the experimental leaf:

```ts
@air-jam/sdk/preview
```

That leaf currently owns:

1. preview launch helpers
2. preview identity helpers
3. preview session manager state
4. shared workspace and floating-window components

## What To Avoid

1. do not build a second controller transport for previews
2. do not inject fake controller state directly into gameplay
3. do not move preview layout/session state into replicated game state
4. do not assume preview-controller APIs are stable root-SDK contracts
