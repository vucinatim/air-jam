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
*   **Tech Stack**: Next.js 15 (App Router), TypeScript, tRPC, BetterAuth, Postgres (Drizzle ORM), Shadcn UI.
*   **Key Features**:
    *   **Developer Dashboard** (`/dashboard`): Register games, generate `aj_live_` API keys.
    *   **Air Jam Arcade** (`/arcade`): The primary "System Host". It maintains a persistent connection to the server and launches games as "Child Hosts".
    *   **Controller Shell** (`/joypad`): A persistent mobile controller shell that dynamically loads game UIs via iframes.
    *   **Database Management**: Owns the schema for Users, Games, and API Keys.

### B. The Game Server (`@air-jam/server`)
*   **Role**: The "Nervous System". Handles low-latency communication and input routing.
*   **Tech Stack**: Node.js, Express, Socket.io, Drizzle ORM.
*   **Key Features**:
    *   **Server-Authoritative Focus**: Manages the "Focus" state of a room (`SYSTEM` or `GAME`).
    *   **Input Routing**: Routes controller inputs to the active host based on the current focus.
    *   **Dual Host Support**: Supports a "Master Host" (Arcade) and a "Child Host" (Game) co-existing in the same room.
    *   **Security**: Verifies API keys and uses `joinToken` for secure Child Host registration.

### C. The SDK (`@air-jam/sdk`)
*   **Role**: The "Bridge". Connects games to the server.
*   **Key Exports**:
    *   `useAirJamHost`: Hook for the main game screen. Automatically detects "Arcade Mode" vs "Standalone Mode".
    *   `useAirJamController`: Hook for the mobile controller view. Automatically detects "Sub-Controller Mode".
    *   `useAirJamShell`: Hook for the Controller Shell, handling `client:load_ui` events.
    *   `AirJamOverlay`: A pre-built UI component. Automatically hides itself when running in Arcade Mode.

## 3. Architecture: Server-Authoritative Focus

Air Jam uses a **Server-Authoritative Focus** model to manage the relationship between the Arcade (System) and the Games (Child).

### Core Concepts

1.  **Master Host (System)**: The Arcade running on the TV. It owns the room and the persistent connection.
2.  **Child Host (Game)**: The Game running in an iframe. It joins the existing room using a secure token.
3.  **Focus**: The Server maintains a `focus` state for each room:
    *   `SYSTEM`: Inputs go to the Master Host (Arcade).
    *   `GAME`: Inputs go to the Child Host (Game).
4.  **Controller Shell**: The phone runs a persistent shell that loads game-specific controllers in an iframe.

### Connection Flow: Launching a Game

1.  **Arcade Launch**:
    *   Arcade calls `host:register_system`.
    *   Server creates room, sets focus to `SYSTEM`.
    *   User connects phone (Controller Shell).

2.  **Game Selection**:
    *   User selects a game on the Arcade.
    *   Arcade emits `system:launch_game` with the Game ID and URL.
    *   Server generates a `joinToken` and returns it to the Arcade.
    *   Server emits `client:load_ui` to all connected Controllers with the Game's Controller URL.

3.  **Game Start**:
    *   Arcade loads the Game in an iframe, passing `aj_room` and `aj_token` in the URL.
    *   Game (Child Host) initializes `useAirJamHost`.
    *   SDK detects `aj_token` and emits `host:join_as_child`.
    *   Server validates token, registers Child Host, and switches focus to `GAME`.
    *   Server sends existing players to the Child Host via `server:controller_joined`.

4.  **Gameplay**:
    *   Controller Shell (iframe) sends inputs.
    *   Server receives inputs and routes them to the **Child Host** (because focus is `GAME`).

5.  **Game Exit**:
    *   User presses "Exit" on Controller or Arcade.
    *   Arcade emits `system:close_game`.
    *   Server switches focus back to `SYSTEM`.
    *   Server emits `client:unload_ui` to Controllers.
    *   Arcade destroys the Game iframe.

### Standalone Mode (Legacy/Dev)

For development or standalone usage, the SDK falls back to the classic behavior:
*   Game calls `host:register`.
*   Server treats it as a Master Host.
*   Controllers connect directly.
*   No shell/iframe logic is involved.

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

For games to work when embedded in the Platform Arcade, they must allow iframe embedding.
**Production**: Games must set `Content-Security-Policy: frame-ancestors *;` header (or restrict to specific domains).
