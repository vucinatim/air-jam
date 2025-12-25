# Architecture

Air Jam consists of four main components in a monorepo structure. This page explains how they work together to enable multiplayer gaming with smartphone controllers.

## System Overview

## Components

### 1. Platform (`apps/platform`)

**Role:** Central hub for the Air Jam ecosystem

**Technology:** Next.js 15, TypeScript, tRPC, BetterAuth, PostgreSQL (Drizzle ORM)

**Key Features:**
- **Developer Portal** - Account management, API key generation, analytics
- **Game Catalog** - Submit, manage, and discover Air Jam games
- **Arcade Mode** - Browse and launch games from a unified interface
- **Controller Shell** - Persistent mobile wrapper that loads game controllers

**Arcade Mode Flow:**
```
1. Player scans QR on arcade screen
2. Platform loads controller shell on phone
3. Player browses games using phone as remote
4. Game launches → controller switches to game's joypad
5. Game ends → returns to arcade browser
```

### 2. Server (`packages/server`)

**Role:** Real-time communication backbone

**Technology:** Node.js, Express, Socket.IO, PostgreSQL

**Core Services:**

**Socket Events:**

### 3. SDK (`packages/sdk`)

**Role:** Developer toolkit for building Air Jam games

**Technology:** React, TypeScript, Socket.IO Client, Zustand, Zod

**Architecture:**

**Key Design Decisions:**

1. **Provider Pattern** - Single provider for configuration, multiple hooks for access
2. **Lightweight Hooks** - `useGetInput`, `useSendSignal` don't trigger re-renders
3. **Input Latching** - Ensures rapid button taps are never missed
4. **Schema Validation** - Type-safe input with runtime validation

### 4. Prototype Game (`apps/prototype-game`)

**Role:** Reference implementation showcasing SDK capabilities

**Technology:** React, Vite, React Three Fiber, Rapier Physics

**Demonstrates:**
- Host-side game logic with physics
- Controller UI with joystick and buttons
- Player spawning/despawning on join/leave
- Haptic feedback on collisions
- Multiple game modes (CTF, survival)

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
│  │  • Receives join token            │  │
│  │  • Controlled player routing      │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Use case:** Featured on Air Jam arcade, game discovery

### Bridge Mode

Controller runs inside platform's shell (iframe communication).

```
┌─────────────────────────────────────────┐
│  Platform Controller Shell (Parent)     │
│  ┌───────────────────────────────────┐  │
│  │  Your Controller UI (iframe)      │  │
│  │  • Input via postMessage          │  │
│  │  • Seamless game switching        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Use case:** Arcade mode controllers, persistent session

## Data Flow

### Input Path (Controller → Game)

```
1. Player moves joystick on phone
2. Controller calls sendInput({ vector: {x, y}, action: false })
3. SDK sends controller:input event to server
4. Server routes to host socket
5. Host SDK's InputManager receives input
6. InputManager validates with Zod schema
7. InputManager applies latching if configured
8. Game calls getInput(playerId) in game loop
9. Returns typed, validated, latched input
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

## Security

### API Key Authentication

- Games must provide valid API key for production
- Keys are validated against platform database
- Rate limiting prevents abuse

### Room Isolation

- Each room has unique 4-character code
- Controllers can only join with correct code
- Input is only routed to the designated host

### Input Validation

- Zod schemas validate all incoming input
- Invalid input is rejected with console warning
- Protects game logic from malformed data