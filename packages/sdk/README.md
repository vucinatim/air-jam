# @air-jam/sdk

Core SDK for building Air Jam hosts and mobile controllers.

## Three Lanes (Canonical)

1. `Input lane` (high frequency, transient):
   `useControllerTick` + `useInputWriter` on controller, `host.getInput` / `useGetInput` on host.
2. `State lane` (replicated, host-authoritative):
   `createAirJamStore` + `useActions` with `(ctx, payload)` action handlers.
3. `Signal lane` (out-of-band UX/system):
   `sendSignal` / `sendSystemCommand` for haptics, toasts, room-level commands, and remote audio cues.

Do not mix lanes:

1. Do not send per-frame stick/button input through store actions.
2. Do not mutate authoritative game state via signals.
3. Do not dispatch state actions via `state.actions.*`; use `useStore.useActions()`.

## Installation

```bash
pnpm add @air-jam/sdk zod
```

## Minimal Setup

Use `createAirJamApp` as the canonical runtime/session wiring API.

```tsx
import { createAirJamApp, env } from "@air-jam/sdk";
import { z } from "zod";

const inputSchema = z.object({
  vector: z.object({ x: z.number(), y: z.number() }),
  action: z.boolean(),
});

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  game: { controllerPath: "/controller" },
  input: { schema: inputSchema },
});
```

## Host Usage

Use `useAirJamHost` in your host/game view.

```tsx
import { useAirJamHost } from "@air-jam/sdk";

export const HostView = () => {
  const host = useAirJamHost({
    onPlayerJoin: (player) => console.log("joined", player.id),
    onPlayerLeave: (controllerId) => console.log("left", controllerId),
  });

  return (
    <section>
      <h1>Room: {host.roomId}</h1>
      <p>Status: {host.connectionStatus}</p>
      <p>Join URL: {host.joinUrl}</p>
    </section>
  );
};
```

Use `host.getInput(controllerId)` in your game loop.

Default input behavior:

- booleans: `pulse` (tap-safe consume-on-read)
- vectors: `latest` (continuous latest value)

Optional overrides are available via `input.behavior` (`pulse | hold | latest`).

### Migration From `input.latch`

If you previously used:

```ts
input: {
  schema,
  latch: {
    booleanFields: ["action"],
    vectorFields: ["vector"],
  },
}
```

Use:

```ts
input: {
  schema,
  behavior: {
    pulse: ["action", "vector"],
  },
}
```

Notes:

- most games can now remove input behavior config entirely (`input: { schema }`)
- booleans default to tap-safe `pulse`
- vectors default to `latest` (continuous)

## Controller Usage

Use `useAirJamController` in your controller view.

```tsx
import {
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";

export const ControllerView = () => {
  const controller = useAirJamController({ nickname: "Player 1" });
  const writeInput = useInputWriter();

  useControllerTick(
    () => {
      writeInput({
        vector: { x: 0, y: 0 },
        action: false,
      });
    },
    {
      enabled:
        controller.connectionStatus === "connected" &&
        controller.gameState === "playing",
      intervalMs: 16,
    },
  );

  return (
    <section>
      <p>Layout: {controller.controllerOrientation}</p>
      <button
        onPointerDown={() =>
          writeInput({
            vector: { x: 0, y: 0 },
            action: true, // one-shot pulses still valid
          })
        }
      >
        Action
      </button>
    </section>
  );
};
```

Controllers usually join via URL query param: `/controller?room=ABCD`.

Hosts can also broadcast the intended controller layout orientation with
`host.sendState({ orientation: "portrait" | "landscape" })`, which controllers
receive as `controller.controllerOrientation`.

## Controller Feedback Helpers

Use SDK hooks for canonical feedback wiring instead of manual socket listeners.

```tsx
import { useAudio, useControllerToasts, useRemoteSound } from "@air-jam/sdk";

const manifest = {
  hit: { src: ["/sounds/hit.wav"] },
};

const ControllerHud = () => {
  const audio = useAudio(manifest);
  const { latestToast } = useControllerToasts();

  useRemoteSound(manifest, audio);

  return latestToast ? <p>{latestToast.message}</p> : null;
};
```

Host-side `sendSignal("TOAST", ...)` now pairs directly with `useControllerToasts()`.

## Optional UI Primitives

`@air-jam/sdk/ui` exports optional presentational primitives (`Button`, `Slider`, `PlayerAvatar`, `VolumeControls`).
These components are lifecycle-free: they do not create sockets or own host/controller session state.

## Networked State (Host Source of Truth)

Use `createAirJamStore` for shared game state synced from host to controllers.

```tsx
import { createAirJamStore } from "@air-jam/sdk";

interface GameState {
  phase: "lobby" | "playing";
  actions: {
    setPhase: (
      ctx: {
        actorId: string;
        role: "controller" | "host";
        connectedPlayerIds: string[];
      },
      payload: { phase: "lobby" | "playing" },
    ) => void;
  };
}

export const useGameStore = createAirJamStore<GameState>((set) => ({
  phase: "lobby",
  actions: {
    setPhase: (_ctx, { phase }) => set({ phase }),
  },
}));

const actions = useGameStore.useActions();
actions.setPhase({ phase: "playing" });
```

Use `useGameStore.useActions()` for action dispatch. On controllers, action calls are proxied to the host automatically and actor identity is attached by the server.

Action context includes `connectedPlayerIds`, so host actions can prune stale assignments without custom presence-sync actions.

## Host Lifecycle Bridge

Use `useHostGameStateBridge` to keep transport pause/play state aligned with your store lifecycle phase transitions.

```tsx
import { useHostGameStateBridge } from "@air-jam/sdk";

useHostGameStateBridge({
  phase: matchPhase, // "lobby" | "playing" | "ended"
  playingPhase: "playing",
  gameState: host.gameState,
  toggleGameState: host.toggleGameState,
});
```

## One Correct Way (Default Path)

1. Define one `airjam` app config with `createAirJamApp`.
2. On controllers, publish input with `useControllerTick` + `useInputWriter`.
3. On hosts, read input with `getInput` / `useGetInput`.
4. Keep replicated gameplay state in `createAirJamStore`.
5. Dispatch all store actions through `useActions()` payload calls.

## Canonical `airjam.config.ts`

Keep one runtime/session declaration and use role wrappers directly in routes.

```tsx
import { createAirJamApp, env } from "@air-jam/sdk";
import { gameInputSchema } from "./types";

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  game: {
    controllerPath: "/controller",
  },
  input: {
    schema: gameInputSchema,
  },
});
```

```tsx
import { Route, Routes } from "react-router-dom";
import { airjam } from "./airjam.config";

export const App = () => (
  <Routes>
    <Route
      path="/"
      element={
        <airjam.Host>
          <HostView />
        </airjam.Host>
      }
    />
    <Route
      path={airjam.paths.controller}
      element={
        <airjam.Controller>
          <ControllerView />
        </airjam.Controller>
      }
    />
  </Routes>
);
```

This keeps runtime config, host input schema, and route path ownership in one place.

## Environment Variables

- `VITE_AIR_JAM_SERVER_URL` / `NEXT_PUBLIC_AIR_JAM_SERVER_URL`
- `VITE_AIR_JAM_APP_ID` / `NEXT_PUBLIC_AIR_JAM_APP_ID`

## Full Docs

- Platform docs: https://air-jam.app/docs
- Monorepo docs index: `docs/docs-index.md`
