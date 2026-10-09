<!-- Generated from content/docs/how-it-works/architecture/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://airjam.io/docs/how-it-works/architecture -->

# Architecture

Air Jam's open framework has three core components: the room server, game SDK,
and creator harness. Reference games show how they work together for multiplayer
gaming with smartphone controllers.

The important current rule is that Air Jam has one framework model, not one model for standalone games and a different model for Arcade.

Arcade is an Air Jam app around another Air Jam app.

## Components

The Arcade and Studio at [airjam.io](https://airjam.io) are a separately operated
product, not an application in this public repository. Their hosted services
compose the same open runtime; standalone games need neither that product nor
its database. The diagrams include hosted surfaces to show how embedding works.

### 1. Server (`packages/server`)

**Role:** Real-time communication backbone

**Technology:** Node.js, Express, Socket.IO

**Core Services:**

**Socket Events:**

### 2. SDK (`packages/sdk`)

**Role:** Developer toolkit for building Air Jam games

**Technology:** React, TypeScript, Socket.IO Client, Zustand, Zod

**Architecture:**

**Key Design Decisions:**

1. **Provider Pattern** - Single provider for configuration, multiple hooks for access
2. **Lightweight Hooks** - `useGetInput`, `useSendSignal` don't trigger re-renders
3. **Input Latching** - Ensures rapid button taps are never missed
4. **Schema Validation** - Type-safe input with runtime validation

### 3. Creator Harness

The public CLI, MCP server and harness packages support project creation,
development, semantic game sessions, visual inspection and release preparation.
The same contracts work with external agents and the managed Studio; creator
tools do not depend on private application source.

### Reference Game: Air Capture (`games/air-capture`)

**Role:** Reference implementation showcasing SDK capabilities

**Technology:** React, Vite, React Three Fiber, Rapier Physics

**Demonstrates:**

- Host-side game logic with physics
- Controller UI with joystick and buttons
- Player spawning/despawning on join/leave
- Haptic feedback on collisions
- Multiple game modes (CTF, survival)

## Core Lane Model

Air Jam uses three lanes and they should stay separate:

1. **Input lane** for high-frequency transient control data via `useInputWriter` and `getInput` / `useGetInput`
2. **Replicated state lane** for replayable shared state via `createAirJamStore`
3. **Signal / command lane** for coarse UX/runtime messages such as haptics, toasts, pause, and exit

This is the same model in standalone games and in Arcade-embedded games.

## Run Modes

The SDK automatically detects and adapts to different deployment scenarios:

### Standalone Mode

Your game runs independently with direct WebSocket connection.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Your Game   │◀───▶│  AirJam      │◀───▶│  Controller  │
│  (Host)      │     │  Server      │     │  (Phone)     │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Use case:** Self-hosted games, development, custom deployments

### Arcade Mode

Game runs inside an iframe on the Air Jam Platform.

```
┌─────────────────────────────────────────┐
│  Air Jam Platform (Parent)              │
│  ┌───────────────────────────────────┐  │
│  │  Your Game (iframe)               │  │
│  │  • Receives launch capability     │  │
│  │  • Controlled player routing      │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Use case:** Featured on Air Jam arcade, game discovery

### Bridge Mode

Controller runs inside platform's runtime wrapper (iframe communication).

```
┌─────────────────────────────────────────┐
│  Platform Controller Runtime (Parent)   │
│  ┌───────────────────────────────────┐  │
│  │  Your Controller UI (iframe)      │  │
│  │  • Input via postMessage          │  │
│  │  • Seamless game switching        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Use case:** Arcade mode controllers, persistent session

### Input Path (Controller → Game)

```
1. Player moves joystick on phone
2. Controller publishes input via useInputWriter({ vector: {x, y}, action: false })
3. SDK sends controller:input event to server
4. Server routes to host socket
5. Host SDK's InputManager receives input
6. InputManager validates with Zod schema
7. InputManager applies configured input behavior (`pulse`, `hold`, `latest`)
8. Game calls getInput(playerId) in game loop
9. Returns typed, validated input with behavior semantics applied
```

### Signal Path (Game → Controller)

```
1. Game detects collision
2. Host calls sendSignal("HAPTIC", { pattern: "heavy" }, playerId)
3. SDK sends host:signal event to server
4. Server routes to target controller(s)
5. Controller SDK receives signal
6. SDK triggers navigator.vibrate() with pattern
7. Player feels haptic feedback
```

### Host Bootstrap

- Hosts perform one `host:bootstrap` verification step in production/static mode
- In normal static mode, the server validates the browser-facing `appId` once, then binds host authority to the socket
- Static apps can optionally restrict bootstrap by allowed origin per app identity
- In optional signed mode, the SDK first fetches a short-lived host grant from `hostGrantEndpoint`, then bootstraps with that grant instead of raw `appId`
- Later host lifecycle events rely on socket authority instead of repeated raw auth payloads

### Child Launch Capability

- Arcade game launch issues a room/game-scoped `launchCapability`
- Embedded host iframes receive `aj_cap` / `aj_cap_exp` automatically
- Game code does not parse or manage this capability directly

### Room Isolation

- Each room has unique 4-character code
- Controllers can only join with correct code
- Input is only routed to the designated host

### Input Validation

- Zod schemas validate all incoming input
- Invalid input is rejected with console warning
- Protects game logic from malformed data
