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

### Option 1: Run Server and Game Separately (Recommended)

**Terminal 1 - Start the local server:**

```bash
pnpm run dev:server
```

The server will start on `http://localhost:4000` in development mode (no authentication required).

**Terminal 2 - Start the game:**

```bash
pnpm run dev
```

The game will be available at `http://localhost:5173` (or the port Vite assigns).

### Option 2: Use the Official Air Jam Server

If you prefer to use the official Air Jam server instead of running locally:

1. Get your API key from the [Air Jam Platform](https://air-jam.app)
2. Set in `.env.local`:
   ```bash
   VITE_AIR_JAM_SERVER_URL=https://api.air-jam.app
   VITE_AIR_JAM_PUBLIC_KEY=your-public-key-here
   ```
3. Run only the game:
   ```bash
   pnpm run dev
   ```

### Option 3: Optional HTTPS for Device Sensors (Gyroscope/Camera)

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
pnpm run dev:secure
```

What `dev:secure` does:

- starts local Air Jam server on `http://localhost:4000`
- starts Vite on `http://localhost:5173`
- runs your named Cloudflare tunnel
- serves your host/controller over the configured HTTPS hostname
- injects `VITE_AIR_JAM_SERVER_URL` and `VITE_AIR_JAM_PUBLIC_HOST` at runtime from `AIR_JAM_SECURE_PUBLIC_HOST`

## Playing the Game

1. Open the game URL in your browser (host view)
2. Scan the QR code with your phone to open the controller / open the controller view in your browser
3. Use the controller to play Pong!

## Project Structure

```
src/
  ├── App.tsx              # Main app component with routing
  ├── host-view.tsx        # Game host view (runs the game)
  ├── controller-view.tsx  # Controller view (mobile interface)
  ├── types.ts             # Game input schema and types
  ├── store.ts             # Shared networked state store
  └── main.tsx             # Entry point
```

## Environment Variables

See `.env.example` for all available environment variables. Key variables:

- `VITE_AIR_JAM_SERVER_URL` - Server URL (defaults to localhost:4000 for local dev)
- `VITE_AIR_JAM_PUBLIC_KEY` - Public API key (optional for local dev, required for production)
- `VITE_AIR_JAM_API_KEY` - Legacy public key variable (still supported)
- `AIR_JAM_SECURE_PUBLIC_HOST` - HTTPS hostname used by `dev:secure` for host/controller URLs
- `CLOUDFLARE_TUNNEL_NAME` - Named Cloudflare tunnel used by `dev:secure`

## Troubleshooting

### Server not connecting locally

1. Ensure `pnpm run dev:server` is running.
2. Verify server health at `http://localhost:4000/health`.
3. Remove or correct `VITE_AIR_JAM_SERVER_URL` overrides in `.env.local`.

### API key errors in deployed environments

1. Ensure `VITE_AIR_JAM_PUBLIC_KEY` is set in your hosting provider.
2. Ensure `VITE_AIR_JAM_SERVER_URL` points to your production Air Jam backend.
3. Re-copy/rotate your key from the Air Jam platform if needed.

### Controller join URL / QR issues

1. Confirm the room code on host and phone matches.
2. If testing on a phone outside localhost, set `VITE_AIR_JAM_PUBLIC_HOST` or use `pnpm run dev:secure`.
3. Ensure SPA rewrites are enabled so `/controller?room=XXXX` resolves to your app (`vercel.json` is included).

## Production Deployment

### Deploying to Vercel

1. Set environment variables in Vercel:
   - `VITE_AIR_JAM_SERVER_URL` - Your official Air Jam server URL
   - `VITE_AIR_JAM_PUBLIC_KEY` - Your public API key from the Air Jam platform

2. Deploy:
   ```bash
   vercel
   ```

The game will connect to the official Air Jam server - no local server needed!
`vercel.json` is included in this template so `/controller?room=XXXX` and other SPA routes resolve correctly.

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
