# Air Jam System Overview

## Overview

Air Jam is a platform for building "AirConsole-style" multiplayer games where a computer/TV acts as the host display and smartphones become game controllers. The platform enables developers to create interactive games with minimal setup while providing players with an intuitive, scan-and-play experience.

---

## Architecture

### High-Level Components

Air Jam consists of four main components in a monorepo structure:

1. **Platform** (`apps/platform`) - Central web portal and game launcher
2. **Server** (`packages/server`) - Real-time WebSocket server
3. **SDK** (`packages/sdk`) - Developer toolkit for building games
4. **Prototype Game** (`apps/prototype-game`) - Reference implementation

---

## Component Details

### 1. Platform (`apps/platform`)

**Role:** The central hub for the Air Jam ecosystem

**Technology:** Next.js 15, TypeScript, tRPC, BetterAuth, PostgreSQL (Drizzle ORM)

**Key Features:**

- **Developer Dashboard** - Game registration and API key management
- **Air Jam Arcade** - System host that launches games in child mode
- **Controller Shell** - Persistent mobile controller with dynamic UI loading
- **User Management** - Authentication and game ownership

**Responsibilities:**

- Manage developer accounts and game catalog
- Generate and validate API keys
- Host the arcade launcher interface
- Provide persistent controller shell for mobile devices

---

### 2. Server (`packages/server`)

**Role:** Real-time communication backbone

**Technology:** Node.js, Express, Socket.IO, PostgreSQL

**Architecture:** Server-authoritative focus model with dual-host support

**Core Services:**

- **Room Manager** - Centralized room state management
- **Auth Service** - API key verification with database integration
- **Focus System** - Controls input routing between system and game

**Key Features:**

- Supports Master Host (Arcade) and Child Host (Game) simultaneously
- Server-controlled focus switching (SYSTEM ↔ GAME)
- Secure token-based child host registration
- Low-latency input routing
- Player sync across host transitions

---

### 3. SDK (`packages/sdk`)

**Role:** Developer toolkit for building Air Jam compatible games

**Technology:** React, TypeScript, Socket.IO Client, Zustand

**Core Hooks:**

- `useAirJamHost` - Game host connection (auto-detects arcade vs standalone)
- `useAirJamController` - Mobile controller connection
- `useAirJamShell` - Controller shell for dynamic UI loading
- `useAirJamInput` - Type-safe input buffer with Zod schema validation
- `useAirJamInputLatch` - Utility hook for input latching (catches rapid taps)

**Internal Utilities:**

- Socket lifecycle management
- Connection state handling
- Room setup and validation
- URL building and normalization

**Components:**

- `AirJamOverlay` - Connection UI (auto-hides in arcade mode)
- `ControllerShell` - Mobile controller wrapper
- `QRScannerDialog` - QR code scanning for room joins

**Features:**

- Automatic mode detection (arcade vs standalone vs bridge)
- Type-safe event protocol
- Type-safe input handling with Zod schema validation
- Input latching for rapid tap detection
- Centralized constants and events
- Audio manager with hybrid playback
- Browser compatibility utilities

---

### 4. Prototype Game (`apps/prototype-game`)

**Role:** Reference implementation and development testbed

**Technology:** React, Three.js, React Three Fiber, Rapier Physics

**Purpose:**

- Demonstrates SDK integration patterns
- Tests dual-host functionality
- Validates arcade mode behavior
- Showcases best practices

---

## Server-Authoritative Focus System

### Concept

The server maintains authoritative control over which host receives controller inputs through a **focus** state:

- **SYSTEM Focus** - Inputs route to Master Host (Arcade)
- **GAME Focus** - Inputs route to Child Host (Game)

### Two-Host Model

**Master Host (System):**

- The Arcade running on the TV
- Owns the room and persistent connection
- Handles game selection and lifecycle

**Child Host (Game):**

- Game running in an iframe
- Joins via secure token
- Receives inputs when focus is GAME

### Connection Flow

**1. Arcade Launch**

- Arcade registers as system host
- Server creates room with SYSTEM focus
- Controllers join via QR code

**2. Game Launch**

- User selects game in arcade
- Server generates secure join token
- Controllers receive game UI URL
- Game joins as child host using token
- Server validates and switches focus to GAME
- Existing players synced to game

**3. Active Gameplay**

- Controllers send inputs to server
- Server routes to child host (focus = GAME)
- Game processes inputs and updates display

**4. Game Exit**

- Exit command received
- Server switches focus back to SYSTEM
- Controllers unload game UI
- Arcade destroys game iframe

### Standalone Mode

For development or simple deployments:

- Game registers as master host
- No arcade or shell involved
- Direct controller-to-game connection
- Traditional single-host model

---

## Security Model

### API Key System

**Production:**

- Developers register games on platform
- Platform issues `aj_live_*` API keys
- Games include key in connection request
- Server verifies against database

**Development:**

- Local server runs without authentication
- No keys required for testing

**Benefits:**

- Prevents unauthorized server usage
- Enables usage tracking per game
- Provides abuse prevention
- Allows individual game control

### Join Tokens

**Purpose:** Secure child host registration

**Flow:**

1. Arcade requests game launch
2. Server generates one-time token
3. Token passed to game via URL
4. Game presents token when joining
5. Server validates and allows connection

---

## Error Handling

### Structured Errors

**ErrorCode Enum:** 13 standardized error types

- Room errors (NOT_FOUND, FULL)
- Auth errors (INVALID_API_KEY, UNAUTHORIZED)
- Token errors (INVALID_TOKEN, EXPIRED)
- Connection errors (FAILED, ALREADY_CONNECTED)
- Validation errors (INVALID_PAYLOAD, INVALID_ROOM_CODE)
- Server errors (INTERNAL, UNAVAILABLE)

**Error Format:** Consistent ServerErrorPayload across all responses

---

## Event Protocol

### Naming Convention

All events use camelCase: `host:registerSystem`, `controller:input`, `server:playSound`

### Event Categories

**Host Events:** Registration, state updates, game launch/close  
**Controller Events:** Join, input, system commands  
**System Events:** Arcade-specific launch/close  
**Server Events:** Acknowledge, sync, notifications  
**Client Events:** Shell UI load/unload

---

## Development Setup

### Requirements

- Node.js 18+
- PostgreSQL database
- pnpm package manager

### Local Stack

**1. Platform**

```
cd apps/platform && pnpm dev
→ http://localhost:3000
```

**2. Server**

```
cd packages/server && pnpm dev
→ WebSocket on port 4000
```

**3. Game**

```
cd apps/prototype-game && pnpm dev
→ http://localhost:5173
```

### Configuration

**Database:** Set `DATABASE_URL` in platform and server `.env`  
**API Keys:** Create game and key via platform dashboard  
**Environment:** Configure game with generated API key

---

## Type Safety

### Approach

- Zero `any` types in codebase
- Browser compatibility types for vendor prefixes
- Type-safe event protocol
- Type-safe input handling with Zod schema inference
- Structured error handling
- Full TypeScript strictness

### Custom Types

- `types/browser.ts` - Vendor-prefixed DOM APIs
- Protocol schemas with Zod validation
- Strongly-typed socket events
- Game-specific input schemas with automatic type inference

## Input Handling

### Architecture

Air Jam provides a flexible, type-safe input system that supports arbitrary input structures while maintaining type safety and developer experience.

### Core Components

**1. `useAirJamInput` Hook**

Generic input buffer for high-frequency input processing in game loops:

- **Zero React re-renders** - Uses refs only (critical for game loops)
- **Zod schema validation** - Optional schema for runtime validation and type inference
- **Type inference** - Automatically infers TypeScript types from Zod schemas
- **Pop-based consumption** - Read once per frame per controller
- **Persistent state** - Input persists until new input arrives (enables latching)

**2. `useAirJamInputLatch` Hook**

Utility hook for adding latching behavior to input structures:

- **Rapid tap detection** - Ensures rapid button taps are never missed
- **Vector flick support** - Keeps stick flicks alive for one frame after release
- **Type preservation** - Maintains full type safety through latching process
- **Configurable fields** - Specify which fields should be latched (boolean/vector)

### Developer Experience

**Defining Input Schema:**

```typescript
import { z } from "zod";

const gameInputSchema = z.object({
  vector: z.object({ x: z.number(), y: z.number() }),
  action: z.boolean(),
  ability: z.boolean(),
  timestamp: z.number(),
});

type GameInput = z.infer<typeof gameInputSchema>;
```

**Using Type-Safe Input:**

```typescript
// With schema - fully typed and validated
const { popInput } = useAirJamInput<GameInput>({
  roomId: "ABCD",
  schema: gameInputSchema, // Optional: enables validation + type inference
});

// With latching - preserves types
const { getLatched } = useAirJamInputLatch<GameInput>({
  booleanFields: ["action", "ability"],
  vectorFields: ["vector"],
});

useFrame(() => {
  const raw = popInput(controllerId);
  if (raw) {
    const latched = getLatched(controllerId, raw);
    // Fully typed! No manual type guards needed
    latched.vector.x; // number
    latched.action; // boolean
  }
});
```

### Benefits

- **Type Safety** - Full TypeScript inference from Zod schemas
- **Runtime Validation** - Invalid inputs are caught and logged
- **Clean API** - No manual type guards or unsafe casts
- **Flexible** - Works with any input structure via Zod schemas
- **Backward Compatible** - Still works without schemas (returns `Record<string, unknown>`)

### Input Flow

1. **Controller sends input** - Arbitrary JSON structure via `controller:input` event
2. **Server routes input** - Based on focus state (SYSTEM or GAME)
3. **Host receives input** - Via `server:input` event
4. **`useAirJamInput` buffers** - Stores raw input, validates if schema provided
5. **`useAirJamInputLatch` processes** - Applies latching logic, preserves types
6. **Game loop consumes** - Fully typed input ready for game logic

---

## Code Organization

### Modular Architecture

**Server:**

- `services/room-manager.ts` - Room state
- `services/auth-service.ts` - Authentication
- Clean separation of concerns

**SDK:**

- `hooks/internal/` - Reusable utilities
- Consolidated patterns across hooks
- Single source of truth for constants/events

### Principles

- DRY (Don't Repeat Yourself)
- Single Responsibility
- Type Safety First
- Reusable Components

---

## Deployment

### Recommended Stack

**Platform:** Vercel (Next.js native)  
**Server:** Railway, Render, or any WebSocket-compatible host  
**Database:** Vercel Postgres, Supabase, or managed PostgreSQL  
**Games:** Developer's choice (Vercel, Netlify, etc.)

### Requirements

**Games Must:**

- Allow iframe embedding (`Content-Security-Policy: frame-ancestors`)
- Use HTTPS in production
- Include valid API key

---

## Future Considerations

### Potential Enhancements

- Stricter TypeScript settings exploration
- JSDoc documentation for public APIs
- Advanced usage examples
- Performance monitoring
- Analytics integration
- Rate limiting
- WebRTC for peer-to-peer data channels

---

## Summary

Air Jam provides a complete platform for building smartphone-controlled games with:

- **Clean architecture** - Modular, maintainable codebase
- **Type safety** - Full TypeScript with zero compromises, including type-safe input handling
- **Security** - API keys and token-based authentication
- **Flexibility** - Arcade mode or standalone deployment
- **Developer experience** - Simple SDK with powerful features, Zod-based input validation, and automatic type inference
