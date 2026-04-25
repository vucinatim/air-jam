<!-- Generated from content/docs/sdk/hooks/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://air-jam.app/docs/sdk/hooks -->

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
  game: {
    controllerPath: "/controller",
  },
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

Consumer hook for host runtime state and actions. Mount `airjam.Host` or `AirJamHostRuntime` once at the boundary, then call `useAirJamHost()` anywhere below it.

Call `useAirJamHost(selector)` when a component only needs a narrow slice of
host session state and you want to avoid rerendering on unrelated runtime
fields.
Selectors receive state fields only; call `useAirJamHost()` when a component
also needs runtime controls such as `joinUrl`, `sendSignal`, or `getInput`.

```tsx
import { AirJamHostRuntime, useAirJamHost } from "@air-jam/sdk";

const HostShell = () => (
  <AirJamHostRuntime
    roomId="GAME"
    input={{ schema: inputSchema }}
    onPlayerJoin={(player) => {
      console.log(`${player.label} joined with color ${player.color}`);
    }}
    onPlayerLeave={(controllerId) => {
      console.log(`Player ${controllerId} left`);
    }}
  >
    <HostView />
  </AirJamHostRuntime>
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
    runtimeState, // "playing" | "paused"
    lastError, // Error message if any
    mode, // "standalone" | "platform"

    // Functions
    getInput, // (controllerId: string) => Input | undefined
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

**Reading Input in Game Loops:**

```tsx
// In a React Three Fiber component
useFrame(() => {
  host.players.forEach((player) => {
    const input = host.getInput(player.id);
    if (!input) return;

    // Move player based on joystick
    movePlayer(player.id, input.vector);

    // Handle button press (tap-safe pulse by default)
    if (input.action) {
      playerShoot(player.id);
    }
  });
});
```

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

### `useGetInput`

Lightweight hook for accessing input without triggering re-renders. Use in performance-critical components.

```tsx
import { useGetInput } from "@air-jam/sdk";

const Ship = ({ playerId }: { playerId: string }) => {
  const getInput = useGetInput();

  // This component won't re-render when connection state changes
  useFrame(() => {
    const input = getInput(playerId);
    if (!input) return;

    // Update ship position
    shipRef.current.position.x += input.vector.x * SPEED;
    shipRef.current.position.y += input.vector.y * SPEED;
  });

  return <mesh ref={shipRef}>...</mesh>;
};
```

**When to use `useGetInput` vs `useAirJamHost().getInput`:**

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

Consumer hook for controller runtime state and actions. Mount `airjam.Controller` or `AirJamControllerRuntime` once at the boundary, then call `useAirJamController()` below it.

Call `useAirJamController(selector)` when a component only needs a narrow slice
of controller session state and should not rerender on unrelated runtime
updates.
Selectors receive state fields only; call `useAirJamController()` when a
component also needs controls such as `sendSystemCommand`.

Standalone controller runtimes also keep one stable local device identity and
automatically attempt same-device resume when reconnecting to the same room.

```tsx
import {
  AirJamControllerRuntime,
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";
import { useRef } from "react";

const ControllerShell = () => (
  <AirJamControllerRuntime
    roomId="ABCD"
    nickname="Player1"
    onState={(state) => {
      if (state.message) {
        showNotification(state.message);
      }
    }}
  >
    <ControllerView />
  </AirJamControllerRuntime>
);

const ControllerView = () => {
  const controller = useAirJamController();
  const writeInput = useInputWriter();
  const vectorRef = useRef({ x: 0, y: 0 });
  const actionRef = useRef(false);

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
  } = controller;

  // Canonical cadence for continuous controls:
  // publish at a fixed tick with useControllerTick + useInputWriter.
  useControllerTick(
    () => {
      writeInput({
        vector: vectorRef.current,
        action: actionRef.current,
        timestamp: Date.now(),
      });
    },
    {
      enabled: connectionStatus === "connected" && runtimeState === "playing",
      intervalMs: 16,
    },
  );

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
      <Joystick
        onMove={(x, y) => {
          vectorRef.current = { x, y };
        }}
      />
      <FireButton
        onPress={() => (actionRef.current = true)}
        onRelease={() => (actionRef.current = false)}
      />
    </div>
  );
};
```

### `useControllerTick`

Fixed-cadence helper for controller loops. Use it with `useInputWriter` instead of hand-rolled `setInterval` loops.

### `useHostTick`

Canonical host loop helper. Pass a named options object with `onTick` plus
the loop mode/options.

- `mode: "raf"` (default) for render-aligned loops.
- `mode: "interval"` for fixed-cadence polling loops.
- `mode: "fixed"` for deterministic fixed-step simulation loops.

In fixed mode, pass `onFrame` when rendering should happen every animation
frame while simulation still advances at the fixed cadence. The frame info
includes `fixedStepAlpha`, which games can use to interpolate between previous
and current simulation state.

```tsx
useHostTick({
  mode: "fixed",
  intervalMs: 16,
  onTick: ({ deltaSeconds }) => {
    stepSimulation(deltaSeconds);
  },
  onFrame: ({ fixedStepAlpha }) => {
    renderInterpolatedFrame(fixedStepAlpha);
  },
});
```

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

| Code                                       | Meaning                                                                   | Expected Fix                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `AJ_SCOPE_MISMATCH`                        | A host/controller hook was used in the wrong scoped provider tree.        | Use the correct scoped wrapper (`airjam.Host` / `airjam.Controller`) or the matching session provider.   |
| `AJ_MISSING_SESSION_PROVIDER`              | SDK context was read outside Air Jam session providers.                   | Wrap the route/root with `airjam.Host`, `airjam.Controller`, or the matching low-level session provider. |
| `AJ_CONFIG_MISSING_SERVER_URL`             | Runtime config cannot resolve server URL when env resolution is disabled. | Provide `serverUrl` prop when using `resolveEnv={false}`.                                                |
| `AJ_CONFIG_MISSING_APP_ID`                 | Production runtime started without canonical app ID config.               | Set `VITE_AIR_JAM_APP_ID` / `NEXT_PUBLIC_AIR_JAM_APP_ID` or pass `appId` explicitly.                     |
| `AJ_STORE_ACTION_SESSION_NOT_READY`        | Controller action dispatch attempted before role/room was ready.          | Wait until room/session is established before dispatching store actions.                                 |
| `AJ_STORE_ACTION_SOCKET_DISCONNECTED`      | Controller state action dispatch attempted while socket disconnected.     | Reconnect before dispatching action.                                                                     |
| `AJ_STORE_ACTION_PAYLOAD_INVALID_SHAPE`    | State action payload root was not omitted or a plain object.              | Dispatch no payload or one plain object payload only.                                                    |
| `AJ_STORE_ACTION_PAYLOAD_NOT_SERIALIZABLE` | State action payload contained non-serializable values.                   | Use JSON-safe payload objects only (no functions/symbols/cycles).                                        |
| `AJ_INPUT_WRITER_INVALID_SHAPE`            | `useInputWriter` payload was not an object.                               | Send plain object payloads only.                                                                         |
| `AJ_INPUT_WRITER_NOT_SERIALIZABLE`         | Input payload contained non-serializable values.                          | Keep input payload JSON-safe.                                                                            |
| `AJ_INPUT_WRITER_SESSION_NOT_READY`        | Input writer called before room/controller identity was ready.            | Start publish loop after controller connection/session is ready.                                         |
| `AJ_INPUT_WRITER_SOCKET_DISCONNECTED`      | Input writer called while controller socket was disconnected.             | Reconnect before sending input.                                                                          |
| `AJ_INPUT_WRITER_SCHEMA_INVALID`           | Input payload failed runtime schema validation.                           | Match payload shape to configured input schema.                                                          |

---

### `PlayerProfile`

```typescript
interface PlayerProfile {
  id: string; // Unique controller ID
  label: string; // Display name (e.g., "Player 1")
  color: string; // Assigned color (e.g., "#FF5733")
  nickname?: string; // Optional player-provided nickname
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
  title: string;
  message?: string;
  variant?: "default" | "success" | "destructive";
}
```
