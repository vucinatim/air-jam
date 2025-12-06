# @air-jam/sdk

The core SDK for building Air Jam games and controllers.

## Installation

```bash
npm install @air-jam/sdk
# or
pnpm add @air-jam/sdk
```

## Usage

### 1. Host (The Game)

Use `useAirJamHost` to register your game session and listen for input.

```tsx
import { useAirJamHost } from "@air-jam/sdk";

function MyGame() {
  const { roomId, joinUrl, connectionStatus, players } = useAirJamHost({
    roomId: "MYROOM", // Optional: Custom room ID
    maxPlayers: 4,
    apiKey: process.env.AIR_JAM_API_KEY, // Required for production
    onPlayerJoin: (player) => console.log("Player joined:", player),
    onInput: (event) => {
      console.log("Input from", event.controllerId, event.input);
    },
  });

  if (connectionStatus === "connecting") return <div>Connecting...</div>;

  return (
    <div>
      <h1>Room: {roomId}</h1>
      <p>Join at: {joinUrl}</p>
      {/* Render your game here */}
    </div>
  );
}
```

### 2. Controller (The Phone)

Use `useAirJamController` to connect a phone to a game session.

```tsx
import { useAirJamController } from "@air-jam/sdk";

function MyController() {
  const { joinRoom, sendInput, connectionStatus } = useAirJamController();

  // Join a room (usually from URL query param)
  useEffect(() => {
    joinRoom("MYROOM", "Player 1");
  }, []);

  const handlePress = () => {
    sendInput({
      action: true,
      vector: { x: 0, y: 0 },
      timestamp: Date.now(),
    });
  };

  return <button onPointerDown={handlePress}>Fire!</button>;
}
```

## API Reference

### `useAirJamHost(options)`

- `options.roomId`: (Optional) Request a specific room code.
- `options.maxPlayers`: (Optional) Limit number of players (default 8).
- `options.apiKey`: (Optional) Your Air Jam API Key (required for production).
- `options.onInput`: Callback for controller input.
- `options.onPlayerJoin`: Callback when a player joins.
- `options.onPlayerLeave`: Callback when a player leaves.

### `useAirJamController()`

- `joinRoom(roomId, nickname)`: Connect to a room.
- `sendInput(input)`: Send input data to the host.
- `connectionStatus`: Current connection state.
