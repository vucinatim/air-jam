# Air Jam Game Template - Pong

A starter template for building multiplayer games with Air Jam. This template includes a simple Pong game that demonstrates the core Air Jam features.

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm (or npm/yarn)
- A mobile device for testing controllers

### Installation

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Configure environment variables (optional - defaults work for local dev):
   ```bash
   mv .env.example .env.local
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

1. Get your API key from the [Air Jam Platform](https://air-jam.com)
2. Set in `.env.local`:
   ```bash
   VITE_AIR_JAM_SERVER_URL=https://your-server-url.com
   VITE_AIR_JAM_API_KEY=your-api-key-here
   ```
3. Run only the game:
   ```bash
   pnpm run dev
   ```

## Playing the Game

1. Open the game URL in your browser (host view)
2. Scan the QR code with your phone to open the controller
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
- `VITE_AIR_JAM_API_KEY` - API key (optional for local dev, required for production)

## Production Deployment

### Deploying to Vercel

1. Set environment variables in Vercel:
   - `VITE_AIR_JAM_SERVER_URL` - Your official Air Jam server URL
   - `VITE_AIR_JAM_API_KEY` - Your API key from the Air Jam platform

2. Deploy:
   ```bash
   vercel
   ```

The game will connect to the official Air Jam server - no local server needed!

### Building for Production

```bash
pnpm run build
```

The built files will be in the `dist/` directory.

## Learn More

- [Air Jam Documentation](https://docs.air-jam.com)
- [SDK Reference](https://docs.air-jam.com/sdk)
- [Examples](https://github.com/vucinatim/air-jam/tree/main/examples)

## License

MIT

