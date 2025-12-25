# Host System

The Air Jam host system manages game sessions and input routing. This page explains how hosts work in different modes and how input flows through the system.

## Host Modes

### Standalone Host

The simplest mode—your game connects directly to the Air Jam server.

**Usage:**

```tsx filename="src/components/HostView.tsx"
const host = useAirJamHost({
  onPlayerJoin: (player) => spawnPlayer(player),
  onPlayerLeave: (id) => removePlayer(id),
});

// Host receives all input directly
useFrame(() => {
  host.players.forEach((p) => {
    const input = host.getInput(p.id);
    processInput(p.id, input);
  });
});
```

### Arcade Mode (Two-Host Model)

In arcade mode, the platform runs a "master" host and your game runs as a "child" host inside an iframe.

## Server-Authoritative Focus System

The server maintains authoritative control over which host receives controller inputs through a **focus** state:

### Why Server-Authoritative?

1. **Security** - Prevents rogue games from stealing input
2. **Reliability** - Single source of truth for focus state
3. **Consistency** - All controllers route to same host

## Connection Flow

### 1. Arcade Launch

```
[Platform]                    [Server]                    [Controller]
    │                             │                            │
    │ host:register               │                            │
    │ { mode: "master" }          │                            │
    │ ───────────────────────────▶│                            │
    │                             │                            │
    │ ack: { ok, roomId: "ABCD" } │                            │
    │ ◀───────────────────────────│                            │
    │                             │                            │
    │  Display QR Code            │                            │
    │  with room code             │     Scan QR Code           │
    │                             │ ◀──────────────────────────│
    │                             │                            │
    │                             │     controller:join        │
    │                             │ ◀──────────────────────────│
    │                             │                            │
    │ server:controllerJoined     │     server:welcome         │
    │ ◀───────────────────────────│ ──────────────────────────▶│
```

### 2. Game Launch

```
[Arcade]              [Server]               [Your Game]        [Controller]
    │                     │                       │                   │
    │ system:launchGame   │                       │                   │
    │ ───────────────────▶│                       │                   │
    │                     │                       │                   │
    │ ack: { joinToken }  │                       │                   │
    │ ◀────────────────── │                       │                   │
    │                     │                       │                   │
    │ Load iframe ───────────────────────────────▶│                   │
    │                     │                       │                   │
    │                     │   host:joinAsChild    │                   │
    │                     │◀───────────────────── │                   │
    │                     │                       │                   │
    │                     │ Focus → GAME          │                   │
    │                     │                       │                   │
    │                     │ Redirect controller   │                   │
    │                     │ ─────────────────────────────────────────▶│
    │                     │                       │                   │
    │                     │                       │   Load game UI    │
```

### 3. Active Gameplay

With focus set to `GAME`, all controller input routes to your game:

```tsx
// Your game receives input normally
const host = useAirJamHost({
  onPlayerJoin: (player) => {
    // Existing players synced on launch
    // New players join during gameplay
    spawnPlayer(player);
  },
});

useFrame(() => {
  host.players.forEach((player) => {
    const input = host.getInput(player.id);
    // Process gameplay...
  });
});
```

### 4. Game Exit

```
[Your Game]           [Server]               [Arcade]           [Controller]
    │                     │                       │                   │
    │ host:exit           │                       │                   │
    │ ───────────────────▶│                       │                   │
    │                     │                       │                   │
    │                     │ Focus → SYSTEM        │                   │
    │                     │                       │                   │
    │                     │ server:gameEnded      │                   │
    │                     │ ─────────────────────▶│                   │
    │                     │                       │                   │
    │              Destroy iframe ◀────────────── │                   │
    │                     │                       │                   │
    │                     │ Restore arcade UI     │                   │
    │                     │ ─────────────────────────────────────────▶│
```

## Host Registration

### Standalone Mode

```tsx
// Automatic registration when useAirJamHost is called
const host = useAirJamHost({
  roomId: "GAME", // Optional custom room code
  maxPlayers: 4, // Optional limit
});

// host.roomId contains the room code
// host.joinUrl contains full URL for QR code
```

### Child Mode (Arcade)

```tsx
// SDK auto-detects arcade mode from URL params
// ?aj_room=ABCD&aj_token=xxxxx

const host = useAirJamHost({
  onPlayerJoin: (player) => {
    // Existing players synced automatically
  },
  onChildClose: () => {
    // Called when arcade closes the game
    cleanupGame();
  },
});

// host.isChildMode === true
```

## Player Management

### Player Lifecycle

```tsx
const host = useAirJamHost({
  onPlayerJoin: (player) => {
    // player.id - Unique identifier
    // player.label - Display name ("Player 1", etc.)
    // player.color - Assigned color ("#FF5733")
    // player.nickname - Optional custom name

    spawnPlayerEntity(player);
    host.sendSignal(
      "TOAST",
      {
        title: `Welcome ${player.label}!`,
      },
      player.id,
    );
  },

  onPlayerLeave: (controllerId) => {
    removePlayerEntity(controllerId);
  },
});
```

### Accessing Players

```tsx
// Current player list
host.players.forEach((player) => {
  console.log(player.label, player.color);
});

// Player count
const playerCount = host.players.length;

// Find specific player
const player = host.players.find((p) => p.id === targetId);
```

## State Broadcasting

Send state updates to all controllers:

```tsx
// Update game state display
host.sendState({
  gameState: "playing", // "playing" | "paused"
  message: "Round 3 - Fight!",
});

// Controllers receive via onState callback
// or controller.gameState / controller.stateMessage
```

## Error Handling

```tsx
const host = useAirJamHost();

// Check connection
if (host.connectionStatus === "disconnected") {
  showReconnectUI();
}

// Check for errors
if (host.lastError) {
  showError(host.lastError);
}

// Force reconnection
host.reconnect();
```