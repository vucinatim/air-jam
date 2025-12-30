# SDK Hooks

The Air Jam SDK provides React hooks for building multiplayer games. This page documents all available hooks and their usage.

## Provider

### `AirJamProvider`

The root provider that must wrap your application. Manages WebSocket connections, state, and input processing.

```tsx
import { AirJamProvider } from "@air-jam/sdk";
import { z } from "zod";

const inputSchema = z.object({
  vector: z.object({ x: z.number(), y: z.number() }),
  action: z.boolean(),
  timestamp: z.number(),
});

<AirJamProvider
  // Optional: WebSocket server URL (auto-detects from env)
  serverUrl="wss://your-server.com"
  // Optional: API key for production
  apiKey="your-api-key"
  // Optional: Max players (default: 8)
  maxPlayers={4}
  // Optional: Input configuration with schema and latching
  input={{
    schema: inputSchema,
    latch: {
      booleanFields: ["action"],
      vectorFields: ["vector"],
    },
  }}
>
  <App />
</AirJamProvider>;
```

**Environment Variables:**

The provider automatically reads from these environment variables if props aren't provided:

- `VITE_AIR_JAM_SERVER_URL` / `NEXT_PUBLIC_AIR_JAM_SERVER_URL` - WebSocket server URL
- `VITE_AIR_JAM_API_KEY` / `NEXT_PUBLIC_AIR_JAM_API_KEY` - API key

---

## Host Hooks

### `useAirJamHost`

The primary hook for game hosts. Connects to the server, manages players, and provides input access.

```tsx
import { useAirJamHost } from "@air-jam/sdk";

const HostView = () => {
  const host = useAirJamHost({
    // Optional: Custom room code (auto-generated if not provided)
    roomId: "GAME",

    // Called when a player joins
    onPlayerJoin: (player) => {
      console.log(`${player.label} joined with color ${player.color}`);
    },

    // Called when a player leaves
    onPlayerLeave: (controllerId) => {
      console.log(`Player ${controllerId} left`);
    },
  });

  // Return values
  const {
    roomId, // "ABCD" - The room code
    joinUrl, // Full URL for controllers to join
    connectionStatus, // "connected" | "connecting" | "disconnected" | "idle"
    players, // Array of PlayerProfile
    gameState, // "playing" | "paused"
    lastError, // Error message if any
    mode, // "standalone" | "arcade" | "platform"

    // Functions
    getInput, // (controllerId: string) => Input | undefined
    sendSignal, // Send haptics/toasts to controllers
    sendState, // Broadcast state to all controllers
    toggleGameState, // Toggle between playing/paused
    reconnect, // Force reconnection
  } = host;

  return (
    <div>
      <h1>Room: {roomId}</h1>
      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?data=${joinUrl}`}
      />
      <p>Players: {players.length}</p>
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

    // Handle button press (automatically latched)
    if (input.action) {
      playerShoot(player.id);
    }
  });
});
```

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
    title: "Achievement Unlocked!",
    message: "First blood",
    variant: "success", // "default" | "success" | "destructive"
  },
  playerId,
);

// Broadcast to all players (omit targetId)
host.sendSignal("TOAST", {
  title: "Round Start!",
  message: "Get ready to fight",
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

## Controller Hooks

### `useAirJamController`

Hook for building mobile controllers that connect to game hosts.

```tsx
import { useAirJamController } from "@air-jam/sdk";

const ControllerView = () => {
  const controller = useAirJamController({
    // Optional: Room from URL query param takes precedence
    roomId: "ABCD",

    // Optional: Player nickname
    nickname: "Player1",

    // Optional: Called when host sends state updates
    onState: (state) => {
      if (state.message) {
        showNotification(state.message);
      }
    },
  });

  const {
    roomId, // Room code (from URL or props)
    controllerId, // This controller's unique ID
    connectionStatus, // Connection state
    gameState, // "playing" | "paused"
    stateMessage, // Optional message from host

    // Functions
    sendInput, // Send input to host
    sendSystemCommand, // "exit" | "ready" | "toggle_pause"
    setNickname, // Update nickname
    reconnect, // Force reconnection
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
    <div>
      <Joystick
        onMove={(x, y) => {
          controller.sendInput({
            vector: { x, y },
            action: false,
            timestamp: Date.now(),
          });
        }}
      />
      <FireButton
        onPress={() => {
          controller.sendInput({
            vector: { x: 0, y: 0 },
            action: true,
            timestamp: Date.now(),
          });
        }}
      />
    </div>
  );
};
```

**Auto Room Join from URL:**

Controllers automatically join rooms from URL query parameters:

```
https://yourgame.com/controller?room=ABCD
```

This is how QR code scanning works—the host generates a URL with the room code embedded.

---

## Utility Hooks

### `useAirJamContext`

Low-level hook for accessing the raw context. Most apps don't need this.

```tsx
import { useAirJamContext } from "@air-jam/sdk";

const { config, store, inputManager } = useAirJamContext();
```

### `useAirJamConfig`

Access the resolved configuration.

```tsx
import { useAirJamConfig } from "@air-jam/sdk";

const config = useAirJamConfig();
console.log(config.serverUrl, config.maxPlayers);
```

### `useAirJamState`

Subscribe to specific state with optimal re-rendering.

```tsx
import { useAirJamState } from "@air-jam/sdk";

const { players, gameState } = useAirJamState((state) => ({
  players: state.players,
  gameState: state.gameState,
}));
```

### `useAirJamSocket`

Get the raw Socket.IO instance for advanced usage.

```tsx
import { useAirJamSocket } from "@air-jam/sdk";

const socket = useAirJamSocket("host");
socket.emit("custom:event", { data: "value" });
```

---

## Types

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

### `GameState`

```typescript
type GameState = "playing" | "paused";
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