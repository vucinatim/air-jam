<!-- Generated from content/docs/sdk/hooks/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://airjam.io/docs/sdk/hooks -->

# SDK Hooks

The Air Jam SDK provides React hooks for building multiplayer games. This page documents all available hooks and their usage.

### `createAirJamApp`

Use `createAirJamApp` as the canonical runtime setup. It wires scoped providers, route paths, and typed input schema in one place.

```tsx
import { createAirJamApp, env } from "@air-jam/sdk";
import { z } from "zod";

const inputSchema = z.object({
  vector: z.object({ x: z.number(), y: z.number() }),
  timestamp: z.number(),
});

const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  controllerPath: "/controller",
  input: { schema: inputSchema },
});

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
</Routes>;
```

**Environment Variables:**

The provider automatically reads from these environment variables if props aren't provided:

- `VITE_AIR_JAM_SERVER_URL` / `NEXT_PUBLIC_AIR_JAM_SERVER_URL` - WebSocket server URL
- `VITE_AIR_JAM_APP_ID` / `NEXT_PUBLIC_AIR_JAM_APP_ID` - Public app ID

---

### `useAirJamHost`

Consumer hook for host runtime state and actions. Mount `airjam.Host` once at the boundary, then call `useAirJamHost()` anywhere below it.

Call `useAirJamHost(selector)` when a component only needs a narrow slice of
host session state and you want to avoid rerendering on unrelated runtime
fields.
Selectors receive state fields only; call `useAirJamHost()` when a component
also needs runtime controls such as `joinUrl` or `sendSignal`.

```tsx
import { useAirJamHost } from "@air-jam/sdk";
import { airjam } from "../airjam.config";

const HostShell = () => (
  <airjam.Host
    roomId="GAME"
    onPlayerJoin={(player) => {
      console.log(`${player.label} joined with color ${player.color}`);
    }}
    onPlayerLeave={(controllerId) => {
      console.log(`Player ${controllerId} left`);
    }}
  >
    <HostView />
  </airjam.Host>
);

const HostView = () => {
  const host = useAirJamHost();

  // Return values
  const {
    roomId, // "ABCD" - The room code
    joinUrl, // Full URL for controllers to join
    joinUrlStatus, // "loading" | "ready" | "unavailable"
    connectionStatus, // "connected" | "connecting" | "disconnected" | "idle"
    players, // Array of PlayerProfile
    controllers, // Rich controller-session roster with source + lease state
    runtimeState, // "playing" | "paused"
    lastError, // Error message if any
    mode, // "standalone" | "platform"

    // Functions
    sendSignal, // Send haptics/toasts to controllers
    sendState, // Publish lightweight controller presentation state
    pauseRuntime, // Set runtimeState to "paused"
    resumeRuntime, // Set runtimeState to "playing"
    setRuntimeState, // Explicitly set "playing" | "paused"
    reconnect, // Force reconnection
  } = host;

  return (
    <div className="relative min-h-screen bg-black text-white">
      <header className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/70 px-4 py-2 backdrop-blur">
        <span>Room {roomId}</span>
        <button
          onClick={runtimeState === "playing" ? pauseRuntime : resumeRuntime}
        >
          {runtimeState === "playing" ? "Pause" : "Resume"}
        </button>
      </header>
      <GameCanvas />
    </div>
  );
};
```

Use `players` for normal gameplay-facing iteration. Use `controllers` when you
need controller provenance or local recovery tooling.

Players' controls reach the game only in its simulation steps, through
`input(playerId)`; see [Input System](./input-system.md).

`sendState` is only for lightweight controller presentation metadata such as
orientation, pause/play status, or short UI messages. It is not the primary
gameplay sync channel. Authoritative multiplayer state should live in the
networked stores and flow automatically through those boundaries.

**Sending Haptic Feedback:**

```tsx
// Vibrate a specific player's phone
host.sendSignal("HAPTIC", { pattern: "heavy" }, playerId);

// Available patterns: "light", "medium", "heavy", "success", "failure", "custom"
host.sendSignal(
  "HAPTIC",
  {
    pattern: "custom",
    sequence: [50, 100, 50], // Vibrate 50ms, pause 100ms, vibrate 50ms
  },
  playerId,
);
```

**Sending Toast Notifications:**

```tsx
// Show notification on a player's controller
host.sendSignal(
  "TOAST",
  {
    message: "Achievement unlocked: First blood",
    color: "#22c55e", // Optional accent color
    duration: 2000, // Optional duration in ms
  },
  playerId,
);

// Broadcast to all players (omit targetId)
host.sendSignal("TOAST", {
  message: "Round start! Get ready to fight.",
});
```

---

### `useSendSignal`

Lightweight hook for sending signals without triggering re-renders. Use in collision handlers.

```tsx
import { useSendSignal } from "@air-jam/sdk";

const Laser = ({ ownerId }: { ownerId: string }) => {
  const sendSignal = useSendSignal();

  const handleHit = (targetId: string) => {
    // Vibrate the player who got hit
    sendSignal("HAPTIC", { pattern: "heavy" }, targetId);

    // Light feedback for the shooter
    sendSignal("HAPTIC", { pattern: "light" }, ownerId);
  };

  // Collision detection...
};
```

---

### `useAirJamController`

Consumer hook for controller runtime state and actions. Mount `airjam.Controller` once at the boundary, then call `useAirJamController()` below it.

Call `useAirJamController(selector)` when a component only needs a narrow slice
of controller session state and should not rerender on unrelated runtime
updates.
Selectors receive state fields only; call `useAirJamController()` when a
component also needs controls such as `sendSystemCommand`.

Standalone controller runtimes also keep one stable local device identity and
automatically attempt same-device resume when reconnecting to the same room.

```tsx
import { useAirJamController } from "@air-jam/sdk";
import { ControlButton, Stick } from "@air-jam/sdk/ui";
import { airjam } from "../airjam.config";
import { shipInput } from "../game/contracts/input";

const ControllerShell = () => (
  <airjam.Controller
    roomId="ABCD"
    nickname="Player1"
    onState={(state) => {
      if (state.message) {
        showNotification(state.message);
      }
    }}
  >
    <ControllerView />
  </airjam.Controller>
);

const ControllerView = () => {
  const controller = useAirJamController();

  const {
    roomId, // Room code (from URL or props)
    controllerId, // This controller's unique ID
    connectionStatus, // Connection state
    runtimeState, // "playing" | "paused"
    controllerOrientation, // "portrait" | "landscape"
    stateMessage, // Optional message from host

    // Functions
    sendSystemCommand, // "exit" | "pause" | "resume"
    setNickname, // Update nickname
    setAvatarId, // Update avatar selection draft
    updatePlayerProfile, // Patch live label/avatar when connected
    selfPlayer, // This controller's player profile when known
    reconnect, // Force reconnection
    input, // This player's declared controls, which phone controls fill
  } = controller;

  if (connectionStatus === "connecting") {
    return <div>Connecting to room {roomId}...</div>;
  }

  if (connectionStatus === "disconnected") {
    return (
      <div>
        Disconnected. <button onClick={reconnect}>Retry</button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 p-4 text-white">
      <div className="mb-2 text-xs uppercase">Room {roomId}</div>
      <div className="mb-2 text-xs uppercase">
        Layout {controllerOrientation}
      </div>
      <Stick control={shipInput.move} className="size-48 rounded-full" />
      <ControlButton control={shipInput.fire}>Fire</ControlButton>
    </div>
  );
};
```

Phone controls send the declared controls themselves; a controller runs no
send loop.

### Game simulation

A game's authoritative state that changes every step, such as positions,
timers and physics, lives in a declared simulation. The SDK steps it on the
host at a fixed rate with seeded randomness, so the same seed and inputs replay
the same game, in a browser or headless and faster than real time.

```ts filename="src/game/engine/simulation.ts"
import { defineAirJamSimulation } from "@air-jam/sdk/core";

export const simulation = defineAirJamSimulation<Sim, GameInput, SimEvent>({
  stepMs: 1000 / 60,
  create: ({ random }) => createSim(random),
  step: (sim, { input, players, runtimeState, random, emit }) => {
    advance(sim, players, input);
  },
  // What agents and tests see of the game, as plain JSON.
  observe: (sim) => ({ fighters: sim.fighters }),
});
```

Declare it with `createAirJamApp({ simulation })`. When its code is heavy, such
as a physics engine, declare a loader instead,
`simulation: () => import("./game/engine/simulation").then((m) => m.simulation)`,
so only the host downloads it and controllers stay small. The host draws and
plays feedback from it, never advances it:

- `useSimulationFrame(({ sim, alpha }) => draw(sim, alpha))` runs after every
  display frame; `alpha` interpolates between steps.
- `useSimulationEvents((event) => playSound(event))` receives what `step`
  emitted, such as a hit.
- `useSimulationSelector((sim) => value, isEqual?)` reads a value for UI, such
  as a health bar or an entity list, re-rendering only when it changes.
- `useSimulation()` returns the clock itself.
- `useHostAgentCapture(() => captureAgentCanvas(canvas))` gives agents an image
  of what the host draws.

Step code reads stores with `gameStore.getState()` and dispatches with
`gameStore.actions`; it never reads `Date.now()` or `Math.random()`.

**Auto Room Join from URL:**

Controllers automatically join rooms from URL query parameters:

```
https://yourgame.com/controller?room=ABCD
```

This is how QR code scanning works—the host generates a URL with the room code embedded.

---

## Advanced (Non-default)

Use these only when integrating platform-specific runtime behavior.

### Raw socket access (escape hatch)

```tsx
const host = useAirJamHost();
host.socket.emit("custom:event", { value: 1 });
```

### Internal context hooks

`useAirJamContext`, `useAirJamConfig`, `useAirJamState`, and `useAirJamSocket` are intentionally internal and are not part of the root public SDK surface.

---

## Diagnostics

Air Jam emits structured diagnostics for common misuse paths in development builds.

```tsx
import { onAirJamDiagnostic, setAirJamDiagnosticsEnabled } from "@air-jam/sdk";

setAirJamDiagnosticsEnabled(true);

const unsubscribe = onAirJamDiagnostic((diagnostic) => {
  console.log(diagnostic.code, diagnostic.message, diagnostic.details);
});
```

### Diagnostics Reference

| Code                                       | Meaning                                                               | Expected Fix                                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `AJ_SCOPE_MISMATCH`                        | A host/controller hook was used in the wrong scoped provider tree.    | Use the correct scoped wrapper (`airjam.Host` / `airjam.Controller`) or the matching session provider.   |
| `AJ_MISSING_SESSION_PROVIDER`              | SDK context was read outside Air Jam session providers.               | Wrap the route/root with `airjam.Host`, `airjam.Controller`, or the matching low-level session provider. |
| `AJ_CONFIG_MISSING_RUNTIME_TOPOLOGY`       | Runtime config cannot resolve the complete topology contract.         | Provide `topology` directly or enable environment resolution for a supported runtime mode.               |
| `AJ_CONFIG_MISSING_APP_ID`                 | Production runtime started without canonical app ID config.           | Set `VITE_AIR_JAM_APP_ID` / `NEXT_PUBLIC_AIR_JAM_APP_ID` or pass `appId` explicitly.                     |
| `AJ_STORE_ACTION_SESSION_NOT_READY`        | Controller action dispatch attempted before role/room was ready.      | Wait until room/session is established before dispatching store actions.                                 |
| `AJ_STORE_ACTION_SOCKET_DISCONNECTED`      | Controller state action dispatch attempted while socket disconnected. | Reconnect before dispatching action.                                                                     |
| `AJ_STORE_ACTION_PAYLOAD_INVALID_SHAPE`    | State action payload root was not omitted or a plain object.          | Dispatch no payload or one plain object payload only.                                                    |
| `AJ_STORE_ACTION_PAYLOAD_NOT_SERIALIZABLE` | State action payload contained non-serializable values.               | Use JSON-safe payload objects only (no functions/symbols/cycles).                                        |
| `AJ_INPUT_INVALID`                         | Input from a controller or agent did not match the declared controls. | Send each declared control in its kind's shape; leave out controls not in use.                           |
| `AJ_INPUT_NOT_DECLARED`                    | A phone control rendered where the game declares no controls.         | Declare them with `createAirJamApp({ input })` and render controls inside `<airjam.Controller>`.         |

---

### `PlayerProfile`

```typescript
interface PlayerProfile {
  id: string; // Unique controller ID
  label: string; // Display name (e.g., "Player 1")
  color?: string; // Assigned color (e.g., "#FF5733")
  avatarId?: string; // Preset avatar id chosen by the player
}
```

### `ConnectionStatus`

```typescript
type ConnectionStatus =
  | "idle" // Not yet connected
  | "connecting" // Connection in progress
  | "connected" // Successfully connected
  | "disconnected" // Connection lost
  | "reconnecting"; // Attempting to reconnect
```

### `RuntimeState`

```typescript
type RuntimeState = "playing" | "paused";
```

### `HapticSignalPayload`

```typescript
interface HapticSignalPayload {
  pattern: "light" | "medium" | "heavy" | "success" | "failure" | "custom";
  sequence?: number | number[]; // For "custom" pattern
}
```

### `ToastSignalPayload`

```typescript
interface ToastSignalPayload {
  message: string;
  color?: string; // Optional accent color (e.g., "#22c55e")
  duration?: number; // Optional duration in ms
}
```
