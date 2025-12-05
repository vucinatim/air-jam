# Air Jam System Overview

This document provides a comprehensive overview of the Air Jam project architecture, current setup, and how the different components interact.

## 1. High-Level Architecture

Air Jam is a platform for building and playing "Air Console" style games where a computer acts as the host screen and smartphones act as controllers.

The system is built as a **monorepo** (using pnpm workspaces) consisting of four main parts:

1.  **Platform (`apps/platform`)**: The central web portal for developers to register games and players to find/play them.
2.  **Game Server (`packages/server`)**: The real-time signaling server that connects Hosts (games) and Controllers (phones).
3.  **SDK (`packages/sdk`)**: A TypeScript library providing React hooks and utilities to easily build Air Jam compatible games.
4.  **Prototype Game (`apps/prototype-game`)**: A reference implementation of a game using the SDK.

## 2. Component Breakdown

### A. The Platform (`apps/platform`)
*   **Role**: The "Brain". Handles user accounts, game registration, and API key generation.
*   **Tech Stack**:
    *   **Framework**: Next.js 15 (App Router)
    *   **Language**: TypeScript
    *   **API**: tRPC (for end-to-end type safety)
    *   **Auth**: BetterAuth (Email/Password, Socials)
    *   **Database**: Postgres (via Drizzle ORM)
    *   **UI**: Shadcn UI + Tailwind CSS (Dark Mode enabled)
*   **Key Features**:
    *   **Developer Dashboard** (`/dashboard`): Register games, generate `aj_live_` API keys.
    *   **Air Jam Arcade** (`/arcade`): Game launcher and controller hub. Acts as a meta-host that can launch games.
    *   **Game Launcher** (`/play/[gameId]`): Plays registered games in a secure `iframe`.
    *   **Controller Interface** (`/joypad`): Mobile controller interface that can display either the default Arcade controller or a game-specific controller in an iframe.
    *   **Database Management**: Owns the schema for Users, Games, and API Keys.

### B. The Game Server (`@air-jam/server`)
*   **Role**: The "Nervous System". Handles low-latency communication between devices.
*   **Tech Stack**: Node.js, Express, Socket.io, Drizzle ORM.
*   **Key Features**:
    *   **WebSocket Signaling**: Manages rooms, connects controllers to hosts.
    *   **Host Takeover**: Allows seamless handoff of rooms between the Arcade and embedded Games.
    *   **Security**: Verifies `apiKey` against the shared Postgres database during `host:register`.
    *   **Input Forwarding**: Relays controller inputs (joystick, buttons, gestures) to the host game loop.

### C. The SDK (`@air-jam/sdk`)
*   **Role**: The "Bridge". Connects games to the server.
*   **Key Exports**:
    *   `useAirJamHost`: Hook for the main game screen. Handles room creation and receiving inputs. Supports "Direct Connect" for embedded games.
    *   `useAirJamController`: Hook for the mobile controller view. Handles sending inputs. Supports "Direct Connect" for embedded controllers.
    *   `AirJamOverlay`: A pre-built UI component displaying the connection QR code and status.
    *   `ControllerShell`: UI shell for controllers. Automatically hides header/controls in child mode.
    *   `AudioManager`: Synced audio playback utilities.

### D. Prototype Game (`apps/prototype-game`)
*   **Role**: The "Proof of Concept".
*   **Tech Stack**: Vite, React, Three.js (React Three Fiber), Rapier (Physics).
*   **Architecture**:
    *   `/`: The Host View (3D Game).
    *   `/joypad`: The Controller View (Mobile Interface).

## 3. Data & Connection Flow

How it all works together when a user plays a game:

1.  **Game Launch**:
    *   User clicks "Play" on the **Platform**.
    *   Platform loads the **Game URL** (e.g., `https://my-game.com`) in an iframe.

2.  **Host Registration**:
    *   The Game (inside iframe) calls `useAirJamHost({ apiKey: "..." })`.
    *   **SDK** connects to **Game Server** via WebSocket (`host:register`).
    *   **Game Server** checks the DB: "Is this API key valid and active?".
    *   If valid, Server creates a Room (e.g., `ABCD`) and confirms connection.

3.  **Controller Connection**:
    *   Game displays the **AirJamOverlay** with a QR Code for the room `ABCD`.
    *   Player scans QR code with phone.
    *   Phone opens the Game URL (`https://my-game.com/joypad?room=ABCD`).
    *   Phone calls `useAirJamController()`.
    *   **SDK** connects to **Game Server** via WebSocket (`controller:join`).

4.  **Gameplay**:
    *   Player presses a button on Phone.
    *   **SDK** sends `controller:input` event to **Game Server**.
    *   **Game Server** forwards event to the **Host** in Room `ABCD`.
    *   **Host** receives input via `onInput` callback and updates game state.

## 3.5. Air Jam Arcade & Direct Connect Architecture

The Platform includes an **Arcade** feature (`/arcade`) that acts as a game launcher. To provide a seamless experience, we use a **"Direct Connect / Handoff"** architecture.

### Seamless Handoff Strategy

Instead of complex proxying, we allow embedded iframes to connect **directly** to the game server, "taking over" the session.

1.  **Arcade Host (Parent)**:
    *   The Arcade page acts as a Host and maintains a room (e.g., `ABCD`).
    *   Controllers connect to this room and use the generic Arcade controls.

2.  **Launching a Game**:
    *   Arcade loads the Game Host in an iframe with `?room=ABCD&airjam_force_connect=true`.
    *   **Game Host (Child)**: Connects to the Server with the same Room Code `ABCD`.
    *   **Server**: Detects a new Host for an existing room. Triggers **Host Takeover**:
        *   Updates the Host Socket ID to the new Game connection.
        *   Preserves all connected Controllers.
        *   Sends `server:controller_joined` events to the new Game for all existing players.
    *   **Result**: The Game starts immediately with all players already connected.

3.  **Switching Controllers**:
    *   The Arcade sends a state update telling controllers to load the Game's controller URL.
    *   **Joypad (Parent)**: Loads the Game Controller in an iframe with `?room=ABCD&controllerId=...&airjam_force_connect=true`.
    *   **Game Controller (Child)**: Connects to the Server directly.
    *   **Server**: Updates the socket ID for that Controller ID, keeping the player in the room.

4.  **Exiting a Game**:
    *   User clicks "Exit" (handled by Arcade UI).
    *   Arcade destroys the Game iframe (Host disconnects).
    *   **Server**: Starts a short **Grace Period** (3s) to keep the room alive.
    *   Arcade immediately calls `host.reconnect()` to reclaim the room.
    *   **Server**: Accepts Arcade as the new Host (Takeover).
    *   Controllers revert to the Arcade interface.

### Key Benefits
-   **Simplicity**: No complex `postMessage` proxy chains for inputs.
-   **Latency**: Direct WebSocket connection ensures lowest possible latency.
-   **Robustness**: Games run as if they were standalone, just with a pre-assigned Room ID.
-   **Flexibility**: Games can implement any feature (Audio, Gyro, etc.) without Platform support.

## 4. Database Schema

We use a shared Postgres database managed by Drizzle ORM in `apps/platform`.

*   `users`: Registered developers/players.
*   `sessions`: Auth sessions for BetterAuth.
*   `games`: Registered games (Name, URL, Owner).
*   `api_keys`: Secure keys linked to Games (used for Server verification).

## 5. Local Development Setup

To run the entire stack locally:

1.  **Database**: Ensure `DATABASE_URL` is set in `apps/platform/.env.local` and `packages/server/.env`.
2.  **Start Platform**:
    ```bash
    cd apps/platform
    pnpm dev
    # Runs on http://localhost:3000
    ```
3.  **Start Server**:
    ```bash
    cd packages/server
    pnpm dev
    # Runs on http://localhost:4000
    ```
4.  **Start Game**:
    ```bash
    cd apps/prototype-game
    pnpm dev
    # Runs on http://localhost:5173
    ```

**Note**: You must create a Game and API Key in the Platform (localhost:3000) and add it to the Game's `.env.local` for the connection to succeed.

### Iframe Embedding Configuration

For games to work when embedded in the Platform Arcade, they must allow iframe embedding. See `IFRAME_EMBEDDING.md` for configuration details.

**Development**: The Vite config already includes headers to allow iframe embedding.  
**Production**: Games must set `Content-Security-Policy: frame-ancestors *;` header (or restrict to specific domains).
