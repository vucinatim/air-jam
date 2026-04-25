<!-- Generated from content/docs/getting-started/introduction/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://air-jam.app/docs/getting-started/introduction -->

# Introduction

Air Jam is a platform for building **"AirConsole-style" multiplayer games** where a computer/TV acts as the host display and smartphones become game controllers. The platform enables developers to create interactive games with minimal setup while providing players with an intuitive, scan-and-play experience.

## Key Features

- **Zero App Download**: Players join by scanning a QR code—no app store required
- **Instant Multiplayer**: Seamlessly connect up to 8 smartphones as controllers
- **Developer Friendly**: Built with modern web technologies (React, TypeScript)
- **Type Safe**: End-to-end type safety with Zod schema validation
- **Performance Optimized**: Tap-safe button input with fixed tick cadence
- **Haptic Feedback**: Send vibration patterns to controllers for game events

### 1. Install the SDK

```bash
pnpm add @air-jam/sdk
```

### 2. Wrap Your App

```tsx filename="src/app.tsx"
import { airjam } from "./airjam.config";

export const App = () => (
  <Routes>
    <Route
      path="/"
      element={
        <airjam.Host
          onPlayerJoin={(player) => {
            console.log(`${player.label} joined!`);
          }}
          onPlayerLeave={(id) => {
            console.log(`Player ${id} left`);
          }}
        >
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

```tsx filename="src/airjam.config.ts"
import { createAirJamApp, env } from "@air-jam/sdk";
import { z } from "zod";

const gameInputSchema = z.object({
  direction: z.number().min(-1).max(1),
  action: z.boolean(),
});

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  game: {
    controllerPath: "/controller",
  },
  input: { schema: gameInputSchema },
});
```

### 3. Create Your Host View

The path below matches the current starter template layout.
It is a good default, not a required framework filename.

```tsx filename="src/host/index.tsx"
import { useAirJamHost } from "@air-jam/sdk";

const HostView = () => {
  const host = useAirJamHost();

  // In your game loop (e.g., useFrame or requestAnimationFrame):
  // host.players.forEach(p => {
  //   const input = host.getInput(p.id);
  //   if (input) {
  //     player.y += input.direction * SPEED;
  //     if (input.action) fireLaser(p.id);
  //   }
  // });

  return (
    <div className="relative min-h-screen bg-black text-white">
      <header className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/70 px-4 py-2 backdrop-blur">
        <span>Room {host.roomId}</span>
        <button
          onClick={
            host.runtimeState === "playing"
              ? host.pauseRuntime
              : host.resumeRuntime
          }
        >
          {host.runtimeState === "playing" ? "Pause" : "Resume"}
        </button>
      </header>
      <GameCanvas />
    </div>
  );
};
```

Mount host ownership once at `<airjam.Host ...>`, then use `useAirJamHost()` only as a consumer hook inside that boundary.

### 4. Create Your Controller View

The path below also matches the current starter template layout.
If your project uses a different file shape, keep the same ownership boundary even if the filename changes.

```tsx filename="src/controller/index.tsx"
import {
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";
import { useRef } from "react";

const ControllerView = () => {
  const controller = useAirJamController();
  const writeInput = useInputWriter();
  const directionRef = useRef(0);

  useControllerTick(
    () => {
      writeInput({
        direction: directionRef.current,
        action: false,
      });
    },
    {
      enabled:
        controller.connectionStatus === "connected" &&
        controller.runtimeState === "playing",
      intervalMs: 16,
    },
  );
};
```

## Canonical Architecture: Three Lanes

Use one lane per concern:

1. **Input lane**: `useControllerTick` + `useInputWriter` (controller), `getInput` / `useGetInput` (host).
2. **State lane**: `createAirJamStore` with host-owned actions and `useActions()` dispatch.
3. **Signal lane**: `sendSignal` / system commands for out-of-band UX and runtime commands.

  Arcade does not replace this model. Arcade is an Air Jam app around another
  Air Jam app, so the same lane rules still apply in embedded runtime mode.

Avoid cross-lane misuse:

1. Don’t stream per-frame movement through store actions.
2. Don’t encode authoritative gameplay state in signals.
3. Don’t call `state.actions.*`; use `useActions()` only.

## Next Steps

- [Architecture](./architecture.md) - Understand the system design
- [Hooks Reference](./sdk-hooks.md) - Complete API documentation
- [Input System](./input-system.md) - Learn about input behavior and validation
