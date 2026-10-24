<!-- Generated from content/docs/getting-started/introduction/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://airjam.io/docs/getting-started/introduction -->

# Introduction

Air Jam is an open **AI-native framework for multiplayer games controlled by
phones**. A computer or TV acts as the host display, smartphones become the
controllers, and both humans and coding agents build against the same runtime,
input, state, and release model.

## Key Features

- **Zero App Download**: Players join by scanning a QR code—no app store required
- **Instant Multiplayer**: Seamlessly connect up to 8 smartphones as controllers
- **Developer Friendly**: Built with modern web technologies (React, TypeScript)
- **AI-Native By Design**: Humans and agents share explicit contracts for runtime, input, logs, and release workflows
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
import {
  axis,
  button,
  defineAirJamInput,
  defineAirJamSimulation,
  type AirJamInputValues,
} from "@air-jam/sdk/core";

export const gameInput = defineAirJamInput({
  direction: axis(),
  fire: button("pressed"),
});

const simulation = defineAirJamSimulation<
  World,
  AirJamInputValues<typeof gameInput>
>({
  stepMs: 1000 / 60,
  create: () => createWorld(),
  step: (world, { input, players, dtSeconds }) => {
    for (const player of players) {
      const { direction, fire } = input(player.id);
      movePaddle(world, player.id, direction * SPEED * dtSeconds);
      if (fire) fireLaser(world, player.id);
    }
  },
});

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  controllerPath: "/controller",
  simulation,
  input: gameInput,
});
```

### 3. Create Your Host View

The path below matches the current starter template layout.
It is a good default, not a required framework filename.

```tsx filename="src/host/index.tsx"
import { useAirJamHost } from "@air-jam/sdk";

const HostView = () => {
  const host = useAirJamHost();
  // The simulation moves the game; this view draws it with useSimulationFrame.

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
import { AxisButton, ControlButton } from "@air-jam/sdk/ui";
import { gameInput } from "../airjam.config";

const ControllerView = () => (
  <div className="grid h-full grid-cols-2 gap-3 p-3">
    <AxisButton control={gameInput.direction} value={-1}>
      Up
    </AxisButton>
    <AxisButton control={gameInput.direction} value={1}>
      Down
    </AxisButton>
    <ControlButton control={gameInput.fire} className="col-span-2">
      Fire
    </ControlButton>
  </div>
);
```

The SDK's phone controls fill the declared controls and send them; the
controller runs no send loop.

## Canonical Architecture: Three Lanes

Use one lane per concern:

1. **Input lane**: controls declared with `defineAirJamInput`, filled by the SDK's phone controls, read in simulation steps with `input(playerId)`.
2. **State lane**: `createAirJamStore` with host-owned actions, dispatched through `store.actions`.
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
- [Input System](./input-system.md) - Declare controls and read them each step
