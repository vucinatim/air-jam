<!-- Generated from content/docs/getting-started/quick-start/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://air-jam.app/docs/getting-started/quick-start -->

# Quick Start

Get your first Air Jam game up and running in minutes using our project generator.

## 1. Create a New Project

The fastest way to start is using our CLI tool. This creates a ready-to-use workspace with a working Pong game, local development server, and SDK configuration.

```bash
npx create-airjam my-game
```

After the project is created, navigate into the directory and open it in your editor:

```bash
cd my-game
code . # or your preferred editor
```

## 2. Start Local Development

The scaffold uses one command for the normal local loop. It starts the local Air Jam server and the game together.

```bash
pnpm run dev
```

That command starts:

1. the local Air Jam server on `http://localhost:4000`
2. the game on `http://localhost:5173`

## 3. Play the Game

Open your browser and visit:

[http://localhost:5173](http://localhost:5173)

You should see the Pong template game. You can now:

1.  Open the game in your browser (Host view)
2.  Scan the QR code with your phone (Controller view)
3.  Play the game!

## Optional: HTTPS for Motion Sensors

Most local Air Jam development works on HTTP. Enable HTTPS only when you need secure browser APIs such as gyroscope or motion sensors.

1. One-time Cloudflare login:
   ```bash
   cloudflared tunnel login
   ```
2. One-time project secure setup:
   ```bash
   pnpm run secure:init -- --hostname my-game-dev.example.com --tunnel my-game-dev
   ```
3. Run secure dev:
   ```bash
   pnpm run dev -- --secure
   ```

This keeps the local Air Jam server on `http://localhost:4000`, tunnels only the Vite host URL through HTTPS, and uses that secure host for controller QR URLs.
`dev -- --secure` injects secure `VITE_AIR_JAM_SERVER_URL` and `VITE_AIR_JAM_PUBLIC_HOST` at runtime from `AIR_JAM_SECURE_PUBLIC_HOST`.

## 4. Customize & Build

This project is "vibecode friendly"—it includes documentation and AI instructions to help you build faster.

- **Check `AGENTS.md`**: Project-wide coding contract and workflow for AI coding assistants.
- **Check `airjam-docs/`**: Local extracted docs bundled with the template.
- **Modify `src/airjam.config.ts`**: Canonical runtime setup and input wiring.
- **Modify `src/game/input.ts`**: Define your input schema.
- **Modify `src/game/store.ts`**: Manage shared networked state.
- **Modify `src/game/host/index.tsx`**: Main host/gameplay view.
- **Modify `src/game/controller/index.tsx`**: Mobile controller interface.

### Server not connecting locally

1. Verify `pnpm run dev` is running.
2. Confirm server health: [http://localhost:4000/health](http://localhost:4000/health).
3. Confirm your game is using `http://localhost:4000` for `VITE_AIR_JAM_SERVER_URL` (or no override at all for local defaults).

### App ID errors in deployed environments

1. Ensure `VITE_AIR_JAM_APP_ID` is set in your host platform.
2. Ensure the server URL points at your real Air Jam backend.
3. Generate/re-copy the App ID from Dashboard if bootstrap fails.

### QR / controller join URL issues

1. Confirm host and controller are on the same room code.
2. If testing on phone outside localhost, set `VITE_AIR_JAM_PUBLIC_HOST` (or use `pnpm run dev -- --secure`).
3. For SPA hosting, ensure rewrites route `/controller?room=XXXX` to your app entry.

## 5. Deploy Your Game

When you're ready to share your game, you'll need to deploy it and connect it to the official Air Jam cloud.

1.  **Create a Game Profile**:
    - Go to the [Platform Dashboard](/dashboard)
    - Create a profile and a new game
    - Copy your **App ID**

2.  **Deploy the Client**:
    - Deploy your game to a static hosting provider like Vercel, Netlify, or GitHub Pages.
    - Set the following environment variables in your deployment settings:

    ```bash
    VITE_AIR_JAM_APP_ID=your_app_id_here
    VITE_AIR_JAM_SERVER_URL=https://api.air-jam.app
    ```

The SDK handles production bootstrap automatically from that `appId`. You do not need to mint tokens or add auth code in your game.
If you want to lock production bootstrap to your deployed site only, set the optional allowed-origin list for the App ID in the dashboard settings.

Before publishing your scaffolded game, run the local checks:

```bash
pnpm run typecheck
pnpm run build
```

### Optional: Stronger Signed Host Bootstrap

If you want stricter production ownership guarantees, you can keep the game static and add one small backend or edge endpoint that returns a signed host grant.

Frontend env:

```bash
VITE_AIR_JAM_HOST_GRANT_ENDPOINT=/api/airjam/host-grant
```

Server env:

```bash
AIR_JAM_HOST_GRANT_SECRET=your_signing_secret
```

The SDK will fetch the host grant automatically before `host:bootstrap`. Your game code stays unchanged.

Example endpoint shape:

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

That endpoint is also where you can add your own rules, for example checking the signed-in user or limiting which app IDs they are allowed to bootstrap.

## 6. Publish to Arcade

To list your game in the official Air Jam Arcade:

1.  Go to your game's settings in the [Dashboard](/dashboard).
2.  Enter your **deployed game URL** (e.g., `https://my-game.vercel.app`).
3.  Optionally add a self-hosted thumbnail, cover image, and preview video URL.
4.  Toggle the **Publish** switch.

Your game is now live and playable by anyone in the Arcade!
