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

**Technology:** TypeScript, Socket.IO Client, Zustand, Zod; React for the binding

**Architecture:**

The SDK is one runtime in two layers:

1. **The core** (`@air-jam/sdk/core`) owns a room: the connection, players,
   input, networked stores and their sync, the game's simulation on the SDK
   clock, signals and the agent contract. It imports no React and no DOM, so
   the same game runs in a browser, in Node without drawing, or faster than
   real time in headless tests.
2. **The React binding** (`@air-jam/sdk`) starts the core for a host or a
   controller page and lets components read it: `useAirJamHost`,
   `useAirJamController`, `useAirJamStore`, `useSimulationFrame`. Hooks
   subscribe to the core; they never keep a second copy of the runtime.

A game declares metadata, stores, simulation, controls and its agent contract
once in `src/airjam.config.ts` with `defineAirJamGame` from core.
`app.tsx` binds it with `createAirJamApp(airjam, { runtime })`. Store
definitions and simulations import from `@air-jam/sdk/core`; components import
from `@air-jam/sdk`.

**Entry points.** Each import path has one purpose:

| Import path                                             | Purpose                                                                                                                 |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `@air-jam/sdk`                                          | React binding: host and controller surfaces and hooks, audio and platform settings                                      |
| `@air-jam/sdk/core`                                     | Framework-free game declaration, agent helpers, networked stores, simulations and runtimes                              |
| `@air-jam/sdk/ui`                                       | Ready-made React components for host and controller shells                                                              |
| `@air-jam/sdk/styles.css`                               | Styles for those components                                                                                             |
| `@air-jam/sdk/metadata`                                 | The game's catalog metadata declaration                                                                                 |
| `@air-jam/sdk/prefabs`                                  | Placeable scene pieces with previews                                                                                    |
| `@air-jam/sdk/preview`                                  | Preview controllers shown beside a host during development                                                              |
| `@air-jam/sdk/protocol`                                 | The wire contract: transport events and their schemas                                                                   |
| `@air-jam/sdk/runtime-topology`                         | Where a runtime connects in each run mode                                                                               |
| `@air-jam/sdk/runtime-control`                          | Calling a running host: agent requests, actions and observations                                                        |
| `@air-jam/sdk/runtime-inspection`                       | Reading what a running host or controller publishes for tools                                                           |
| `@air-jam/sdk/agent-tooling`                            | Checking and evaluating a game's agent contract                                                                         |
| `@air-jam/sdk/controller-bridge`                        | Owning a controller's room connection from outside its page                                                             |
| `@air-jam/sdk/arcade/*`                                 | Embedding games in the Arcade: `bridge/host`, `bridge/controller`, `bridge/iframe`, `host`, `runtime`, `surface`, `url` |
| `@air-jam/sdk/release`, `@air-jam/sdk/platform-machine` | Contracts with the hosted platform for releases and the CLI                                                             |

Games use the first five or six; the rest serve the CLI, MCP server, devtools,
the server and the hosted platform.

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

1. **Input lane** for players' controls: declared with `defineAirJamInput`, filled by phone controls, agents or replays, and read once per simulation step
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
1. Player holds a stick or button rendered by the SDK's phone controls
2. The controller's input lane updates the declared control's state
3. Once per display frame, if anything changed, the SDK sends controller:input
4. Server routes it to the host socket
5. The host's input lane validates it against the declared controls
6. Before each simulation step, the host samples every player's controls and
   applies each kind's meaning (a pressed button reads true for one step)
7. The step reads input(playerId)
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

- Every incoming input is checked against the game's declared controls
- Invalid input is dropped with an `AJ_INPUT_INVALID` diagnostic
- Agents' input passes the same check before they take a seat
