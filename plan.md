Air Jam Project Overview & Release Plan
1. Current State Analysis
We have a solid foundation consisting of three main components:

A. @air-jam/sdk (Package)
The core library that powers the experience.

Purpose: Bridge between the Game (Host) and the Phone (Controller).
Key Features:
useAirJamHost: Hook for games to register rooms and receive input.
useAirJamController: Hook for phones to join rooms and send input.
AudioManager: Synchronized audio playback.
AirJamOverlay: UI component for connection status and QR codes.
Protocol: Type-safe definitions for all WebSocket events (host:register, controller:input, etc.).
Tech: React, Zustand, Socket.io-client, Howler.js, Zod.
B. @air-jam/server (Package)
The signaling backend.

Purpose: Relays messages between Hosts and Controllers.
Key Features:
Room management (creation, joining, leaving).
Input forwarding (low latency).
State synchronization.
Deployment: Currently local Node.js script. Ready for WebSocket-compatible hosting (Railway).
Tech: Express, Socket.io, Cors, Zod.
C. prototype-game (App)
The proof-of-concept game.

Purpose: Demonstrates the SDK in action.
Architecture:
Host View (/): The main game (React + Three.js + Rapier).
Controller View (/joypad): The mobile interface hosted within the game app.
Flow: User opens Game -> Scans QR -> Phone opens Game URL (/joypad) -> Connects to Server -> Controls Game.
2. Proposed Architecture for Release
To turn this into a public platform, we need to fill the gaps: The Platform Web App, Security, and Deployment Strategy.

A. The "Platform" Web App
A new Next.js application acting as the central hub.

For Players: A catalog of games. "Air Jam Arcade".
Browse games.
Click "Play" -> Opens game in an iframe or new tab.
For Developers: A developer portal.
Sign up / Login.
Register Game: Submit Game Name, Description, URL.
Get API Key: Generate a secure key for their game to talk to the Official Server.
B. Security & Connection Flow
How do we ensure secure and smooth connections?

The "API Key" Strategy:

Development: Devs run a local server (npm run dev:server). No keys needed.
Production:
Dev registers game on Air Jam Platform.
Platform issues an API Key (e.g., aj_live_...).
Dev adds AIR_JAM_API_KEY to their game's environment variables (e.g., on Vercel).
When the Game calls useAirJamHost, it passes this key.
Official Server verifies the key before allowing host:register.
Why this is good:

Prevents abuse of your paid server resources.
Allows you to track usage/analytics per game.
Gives you a "kill switch" for bad actors.
C. Deployment Strategy
Component	Hosting	Notes
Official Server	Railway	Excellent WebSocket support, easy scaling.
Platform App	Vercel	Next.js native, handles auth & DB (Postgres/Supabase).
User Games	Vercel (User's choice)	Users deploy their own games.
SDK	NPM	Published as @air-jam/sdk.