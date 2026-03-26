# Air Jam Game Template - Pong

A starter template for building multiplayer games with Air Jam. This template includes a simple Pong game that demonstrates the core Air Jam features.

## Getting Started

### Installation

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Configure environment variables (optional - defaults work for local dev):

   ```bash
   cp .env.example .env.local
   ```

   Then edit `.env.local` with your settings if needed.

## Local Development

### Default (Recommended)

```bash
pnpm run dev
```

This starts both the local Air Jam server (`http://localhost:4000`) and the game (`http://localhost:5173`) in one command.
It also auto-detects your LAN IP and sets `VITE_AIR_JAM_PUBLIC_HOST` so QR links are phone-friendly by default.

### Use Official Air Jam Backend (No Local Server)

If you prefer to use the official Air Jam server instead of running locally:

1. Get your app ID from the [Air Jam Platform](https://air-jam.app)
2. Set in `.env.local`:
   ```bash
   VITE_AIR_JAM_SERVER_URL=https://api.air-jam.app
   VITE_AIR_JAM_APP_ID=your-app-id-here
   ```
3. Start web-only mode:
   ```bash
   pnpm run dev -- --web-only
   ```

### Optional HTTPS (Gyroscope/Camera APIs)

Most local development works on plain HTTP. Use this only when you need secure browser APIs (gyroscope, motion sensors, some camera APIs).

One-time setup per project:

1. Log in to Cloudflare Tunnel:
   ```bash
   cloudflared tunnel login
   ```
2. Initialize secure mode:
   ```bash
   pnpm run secure:init -- --hostname my-game-dev.example.com --tunnel my-game-dev
   ```
   This writes `.cloudflared/config.yml` and updates `.env.local`.

Daily secure dev:

```bash
pnpm run dev -- --secure
```

What `dev -- --secure` does:

- starts local Air Jam server on `http://localhost:4000`
- starts Vite on `http://localhost:5173`
- runs your named Cloudflare tunnel
- serves your host/controller over the configured HTTPS hostname
- injects `VITE_AIR_JAM_SERVER_URL` and `VITE_AIR_JAM_PUBLIC_HOST` at runtime from `AIR_JAM_SECURE_PUBLIC_HOST`

## Playing the Game

1. Open the game URL in your browser (host view)
2. Scan the QR code with your phone to open the controller / open the controller view in your browser
3. Use the controller to play Pong!

### Lobby Flow (Template Defaults)

- Game opens in a lobby state.
- Host shows a dedicated lobby screen (QR + team readiness, no debug control bar).
- Controllers pick a team (`SOLARIS` / `NEBULON`).
- Controllers set `Points to Win` (`3`, `5`, `7`, `11`).
- Optional: enable `Bot Opponent` from the controller lobby.
- Press `Start Match` to begin.
- During a running match, use `Pause` / `Resume` and `Lobby` from controller.
- Match transitions to an `ended` state automatically when one team reaches target points.
- Ended state provides `Play Again` and `Back to Lobby` from controller.

### Feedback Pattern (Canonical)

- Host feedback is centralized in `src/game/host/use-pong-feedback.ts`.
- Paddle collisions trigger:
  - controller-only `hit` sound (targeted to the player who touched the ball)
  - controller-only haptic pulse (`light`) for that same player
- Score events trigger:
  - host-only sound (`score`)
- Match start/end trigger host-only start/win cues.
- Match end also broadcasts a controller `TOAST` message with winner + final score.
- Sound manifest is defined in `src/game/shared/sounds.ts` and files live in `public/sounds`.

## Project Structure

```
src/
  ├── app.tsx                     # Main app component with routing
  ├── airjam.config.ts            # Canonical runtime/game metadata
  ├── game/
  │   ├── input.ts                # Input schema/types
  │   ├── store.ts                # Shared networked state store
  │   ├── controller/
  │   │   ├── index.tsx           # Controller game view shell
  │   │   ├── components/         # Header, lobby, playing controls, ended panel
  │   │   └── hooks/              # Controller connection guard/use-case hooks
  │   ├── host/
  │   │   ├── index.tsx           # Host game view shell
  │   │   ├── components/         # Lobby/ended/overlay host UI
  │   │   ├── game-engine/        # Simulation modules (input/collision/render)
  │   │   └── use-pong-feedback.ts # Canonical host-owned feedback policy
  │   └── shared/
  │       ├── team.ts             # Team domain (ids/labels/colors)
  │       ├── match-readiness.ts  # Canonical readiness logic/text
  │       └── sounds.ts           # Shared sound manifest
  └── main.tsx                    # Entry point
```

## Runtime Pattern (Canonical)

- `airjam.config.ts` is the single source for runtime metadata + provider config.
- `airjam.Host` wraps `HostView` from `src/game/host/index.tsx` and owns input schema + behavior defaults.
- `airjam.Controller` wraps `ControllerView` from `src/game/controller/index.tsx`.
- Controller input is published on a fixed 16ms cadence using `useInputWriter` in `src/game/controller/index.tsx`.
- Host input is consumed with `host.getInput(playerId)` in the game loop.

## Canonical Usage Rules

- Keep game lifecycle in the networked store (`lobby`, `playing`, `ended`), not in transport state.
- Treat `gameState` (`paused` / `playing`) as runtime pause only.
- Host owns authority for simulation, scoring, and state transitions; controllers send input + actions.
- Keep feedback centralized in host feedback modules (`use-pong-feedback`): no scattered side-effects.
- Target controller feedback explicitly when needed (e.g., hitter-only hit cue) and keep broad cues host-local by default.

## What SDK Handles For You

- Remote controller sound playback: use `useRemoteSound(manifest, audio)` instead of manual `server:playSound` socket subscriptions.
- Controller toast signaling: use `useControllerToasts()` to consume host `sendSignal("TOAST", ...)`.
- Presence-aware action context: every store action receives `ctx.connectedPlayerIds` (no custom presence sync action needed).
- Host phase/runtime bridge: use `useHostGameStateBridge(...)` for canonical lifecycle-to-pause/play synchronization.

## Environment Variables

See `.env.example` for all available environment variables. Key variables:

- `VITE_AIR_JAM_SERVER_URL` - Server URL (defaults to localhost:4000 for local dev)
- `VITE_AIR_JAM_APP_ID` - Public app ID (optional for local dev, required for production)
- `AIR_JAM_SECURE_PUBLIC_HOST` - HTTPS hostname used by `dev -- --secure` for host/controller URLs
- `CLOUDFLARE_TUNNEL_NAME` - Named Cloudflare tunnel used by `dev -- --secure`

## Troubleshooting

### Server not connecting locally

1. Ensure `pnpm run dev` is running.
2. Verify server health at `http://localhost:4000/health`.
3. Remove or correct `VITE_AIR_JAM_SERVER_URL` overrides in `.env.local`.

### App ID errors in deployed environments

1. Ensure `VITE_AIR_JAM_APP_ID` is set in your hosting provider.
2. Ensure `VITE_AIR_JAM_SERVER_URL` points to your production Air Jam backend.
3. Re-copy/rotate your App ID from the Air Jam platform if needed.

### Controller join URL / QR issues

1. Confirm the room code on host and phone matches.
2. If testing on a phone outside localhost, set `VITE_AIR_JAM_PUBLIC_HOST` or use `pnpm run dev -- --secure`.
3. Ensure SPA rewrites are enabled so `/controller?room=XXXX` resolves to your app (`vercel.json` is included).

## Production Deployment

### Deploying to Vercel

1. Set environment variables in Vercel:
   - `VITE_AIR_JAM_SERVER_URL` - Your official Air Jam server URL
   - `VITE_AIR_JAM_APP_ID` - Your app ID from the Air Jam platform

2. Deploy:
   ```bash
   vercel
   ```

The game will connect to the official Air Jam server - no local server needed!
`vercel.json` is included in this template so `/controller?room=XXXX` and other SPA routes resolve correctly.

### Optional: Stronger Signed Host Bootstrap

If you want stricter ownership guarantees without giving up static hosting, keep the game static and add one small backend or edge route that returns a signed host grant.

Frontend env:

```bash
VITE_AIR_JAM_HOST_GRANT_ENDPOINT=/api/airjam/host-grant
```

Server env:

```bash
AIR_JAM_HOST_GRANT_SECRET=your_signing_secret
```

Minimal endpoint shape:

```ts
import { createHostGrant } from "@air-jam/sdk/protocol";

export async function POST(request: Request) {
  const { appId } = await request.json();

  const hostGrant = await createHostGrant({
    secret: process.env.AIR_JAM_HOST_GRANT_SECRET!,
    claims: {
      appId,
      exp: Math.floor(Date.now() / 1000) + 60,
      origins: ["https://your-game.example"],
    },
  });

  return Response.json({ hostGrant });
}
```

The SDK fetches that grant automatically before `host:bootstrap`. Your host/controller game code does not change.

### Building for Production

```bash
pnpm run build
```

The built files will be in the `dist/` directory.

## Learn More

- [Air Jam Documentation](https://air-jam.app/docs)
- [Platform](https://air-jam.app)
- [Examples](https://github.com/vucinatim/air-jam/tree/main/apps)

## License

MIT
