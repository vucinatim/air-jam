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
- Structured error handling
- Full TypeScript strictness

### Custom Types

- `types/browser.ts` - Vendor-prefixed DOM APIs
- Protocol schemas with Zod validation
- Strongly-typed socket events

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
- **Type safety** - Full TypeScript with zero compromises
- **Security** - API keys and token-based authentication
- **Flexibility** - Arcade mode or standalone deployment
- **Developer experience** - Simple SDK with powerful features
