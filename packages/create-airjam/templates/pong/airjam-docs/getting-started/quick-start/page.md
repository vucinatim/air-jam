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

You'll need two terminal windows to run the local development environment: one for the backend server and one for the game client.

**Terminal 1: Start the Server**
This runs the local WebSocket server that handles game connections.

```bash
pnpm dev:server
```

> **Note:** The local server runs on `http://localhost:4000`.

**Terminal 2: Start the Game**
This runs the game client (Vite).

```bash
pnpm dev
```

## 3. Play the Game

Open your browser and visit:

[http://localhost:5173](http://localhost:5173)

You should see the Pong template game. You can now:
1.  Open the game in your browser (Host view)
2.  Scan the QR code with your phone (Controller view)
3.  Play the game!

## 4. Customize & Build

This project is "vibecode friendly"—it includes documentation and AI instructions to help you build faster.

- **Check `AI_INSTRUCTIONS.md`**: Provides context for AI coding assistants.
- **Modify `src/host-view.tsx`**: Contains the main game logic and rendering.
- **Modify `src/controller-view.tsx`**: Defines the mobile controller interface.
- **Modify `src/store.ts`**: Manage shared networked state.
- **Modify `src/types.ts`**: Define your game input schema.

## 5. Deploy Your Game

When you're ready to share your game, you'll need to deploy it and connect it to the official Air Jam cloud.

1.  **Create a Game Profile**:
    - Go to the [Platform Dashboard](/dashboard)
    - Create a profile and a new game
    - Copy your **API Key**

2.  **Deploy the Client**:
    - Deploy your game to a static hosting provider like Vercel, Netlify, or GitHub Pages.
    - Set the following environment variables in your deployment settings:

    ```bash
    VITE_AIR_JAM_API_KEY=your_api_key_here
    VITE_AIR_JAM_SERVER_URL=wss://api.air-jam.app
    ```

## 6. Publish to Arcade

To list your game in the official Air Jam Arcade:

1.  Go to your game's settings in the [Dashboard](/dashboard).
2.  Enter your **deployed game URL** (e.g., `https://my-game.vercel.app`).
3.  Toggle the **Publish** switch.

Your game is now live and playable by anyone in the Arcade!