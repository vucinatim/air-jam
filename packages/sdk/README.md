# @air-jam/sdk

Core SDK for building Air Jam hosts and mobile controllers.

## Installation

```bash
pnpm add @air-jam/sdk zod
```

## Minimal Setup

Wrap your app with `AirJamProvider`.

```tsx
import { AirJamProvider } from "@air-jam/sdk";
import { z } from "zod";

const inputSchema = z.object({
  vector: z.object({ x: z.number(), y: z.number() }),
  action: z.boolean(),
});

export const App = () => (
  <AirJamProvider
    input={{
      schema: inputSchema,
      latch: {
        booleanFields: ["action"],
        vectorFields: ["vector"],
      },
    }}
  >
    {/* your router/views */}
  </AirJamProvider>
);
```

## Host Usage

Use `useAirJamHost` in your host/game view.

```tsx
import { HostShell, useAirJamHost } from "@air-jam/sdk";

export const HostView = () => {
  const host = useAirJamHost({
    maxPlayers: 4,
    onPlayerJoin: (player) => console.log("joined", player.id),
    onPlayerLeave: (controllerId) => console.log("left", controllerId),
  });

  return (
    <HostShell>
      <h1>Room: {host.roomId}</h1>
      <p>Status: {host.connectionStatus}</p>
      <p>Join URL: {host.joinUrl}</p>
    </HostShell>
  );
};
```

Use `host.getInput(controllerId)` in your game loop.

## Controller Usage

Use `useAirJamController` in your controller view.

```tsx
import { ControllerShell, useAirJamController } from "@air-jam/sdk";

export const ControllerView = () => {
  const controller = useAirJamController({ nickname: "Player 1" });

  return (
    <ControllerShell forceOrientation="portrait">
      <button
        onPointerDown={() =>
          controller.sendInput({
            vector: { x: 0, y: 0 },
            action: true,
          })
        }
      >
        Action
      </button>
    </ControllerShell>
  );
};
```

Controllers usually join via URL query param: `/controller?room=ABCD`.

## Networked State (Host Source of Truth)

Use `createAirJamStore` for shared game state synced from host to controllers.

```tsx
import { createAirJamStore } from "@air-jam/sdk";

interface GameState {
  phase: "lobby" | "playing";
  actions: {
    setPhase: (phase: "lobby" | "playing") => void;
  };
}

export const useGameStore = createAirJamStore<GameState>((set) => ({
  phase: "lobby",
  actions: {
    setPhase: (phase) => set({ phase }),
  },
}));
```

On controllers, action calls are proxied to the host automatically.

## Environment Variables

- `VITE_AIR_JAM_SERVER_URL` / `NEXT_PUBLIC_AIR_JAM_SERVER_URL`
- `VITE_AIR_JAM_PUBLIC_KEY` / `NEXT_PUBLIC_AIR_JAM_PUBLIC_KEY`
- Legacy public key vars are still supported:
  - `VITE_AIR_JAM_API_KEY`
  - `NEXT_PUBLIC_AIR_JAM_API_KEY`

## Full Docs

- Platform docs: https://air-jam.app/docs
- Monorepo docs index: `docs/docs-index.md`
