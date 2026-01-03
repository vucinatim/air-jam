# Introduction

Air Jam is a platform for building **"AirConsole-style" multiplayer games** where a computer/TV acts as the host display and smartphones become game controllers. The platform enables developers to create interactive games with minimal setup while providing players with an intuitive, scan-and-play experience.

## Key Features

- **Zero App Download**: Players join by scanning a QR code—no app store required
- **Instant Multiplayer**: Seamlessly connect up to 8 smartphones as controllers
- **Developer Friendly**: Built with modern web technologies (React, TypeScript)
- **Type Safe**: End-to-end type safety with Zod schema validation
- **Performance Optimized**: Latching system ensures no input is ever missed
- **Haptic Feedback**: Send vibration patterns to controllers for game events

## How It Works

## Quick Start

### 1. Install the SDK

```bash
pnpm add @air-jam/sdk
```

### 2. Wrap Your App

```tsx filename="src/App.tsx"
import { AirJamProvider } from "@air-jam/sdk";
import { z } from "zod";

// Define your input schema (matches Pong template)
const gameInputSchema = z.object({
  direction: z.number().min(-1).max(1), // -1 (up), 0 (stop), 1 (down)
  action: z.boolean(), // e.g. Start Game / Fire
});

export const App = () => (
  <AirJamProvider
    input={{
      schema: gameInputSchema,
      latch: {
        // Latch boolean inputs to ensure short taps are caught in the game loop
        booleanFields: ["action"],
      },
    }}
  >
    <Routes>
      <Route path="/" element={<HostView />} />
      <Route path="/controller" element={<ControllerView />} />
    </Routes>
  </AirJamProvider>
);
```

### 3. Create Your Host View

```tsx filename="src/components/HostView.tsx"
import { HostShell, useAirJamHost } from "@air-jam/sdk";

const HostView = () => {
  const host = useAirJamHost({
    onPlayerJoin: (player) => {
      console.log(`${player.label} joined!`);
      // Spawn player logic...
    },
    onPlayerLeave: (id) => {
      console.log(`Player ${id} left`);
      // Despawn player logic...
    },
  });

  // In your game loop (e.g., useFrame or requestAnimationFrame):
  // host.players.forEach(p => {
  //   const input = host.getInput(p.id);
  //   if (input) {
  //     player.y += input.direction * SPEED;
  //     if (input.action) fireLaser(p.id);
  //   }
  // });

  return (
    <HostShell>
      {/* HostShell automatically provides:
          - Top navbar with room ID and player avatars
          - QR code overlay when paused
          - Play/pause controls
          - Settings panel
      */}
      <GameCanvas />
    </HostShell>
  );
};
```

### 4. Create Your Controller View

```tsx filename="src/components/ControllerView.tsx"
import { useAirJamController, ControllerShell } from "@air-jam/sdk";

const ControllerView = () => {
  const controller = useAirJamController();

  const sendInput = (direction: number, action: boolean) => {
    controller.sendInput({ direction, action });
  };

  return (
    // ControllerShell handles connection status, errors, and platform integration
    <ControllerShell forceOrientation="portrait">
      <div className="flex h-full flex-col gap-4 p-4">
        <button
          className="flex-1 rounded-xl bg-blue-500"
          onTouchStart={() => sendInput(-1, false)}
          onTouchEnd={() => sendInput(0, false)}
        >
          UP
        </button>
        <button
          className="flex-1 rounded-xl bg-blue-500"
          onTouchStart={() => sendInput(1, false)}
          onTouchEnd={() => sendInput(0, false)}
        >
          DOWN
        </button>
        <button
          className="h-24 rounded-xl bg-red-500"
          onClick={() => sendInput(0, true)}
        >
          ACTION
        </button>
      </div>
    </ControllerShell>
  );
};
```

## Next Steps

- [Architecture](/docs/how-it-works/architecture) - Understand the system design
- [Hooks Reference](/docs/sdk/hooks) - Complete API documentation
- [Input System](/docs/sdk/input-system) - Learn about latching and validation