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
    *   **Developer Dashboard**: Register games, generate `aj_live_` API keys.
    *   **Game Launcher**: Plays registered games in a secure `iframe`.
    *   **Database Management**: Owns the schema for Users, Games, and API Keys.

### B. The Game Server (`@air-jam/server`)
*   **Role**: The "Nervous System". Handles low-latency communication between devices.
*   **Tech Stack**: Node.js, Express, Socket.io, Drizzle ORM.
*   **Key Features**:
    *   **WebSocket Signaling**: Manages rooms, connects controllers to hosts.
    *   **Security**: Verifies `apiKey` against the shared Postgres database during `host:register`.
    *   **Input Forwarding**: Relays controller inputs (joystick, buttons, gestures) to the host game loop.

### C. The SDK (`@air-jam/sdk`)
*   **Role**: The "Bridge". Connects games to the server.
*   **Key Exports**:
    *   `useAirJamHost`: Hook for the main game screen. Handles room creation and receiving inputs.
    *   `useAirJamController`: Hook for the mobile controller view. Handles sending inputs.
    *   `AirJamOverlay`: A pre-built UI component displaying the connection QR code and status.
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

