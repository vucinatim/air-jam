<!-- Generated from content/docs/getting-started/quick-start/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://airjam.io/docs/getting-started/quick-start -->

# Quick Start

Get your first Air Jam game up and running in minutes using our project generator.

You need Node.js 22.15 or newer and pnpm installed. The generator runs `pnpm install`
for you unless you explicitly choose `--skip-install`.

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

If Claude Code Desktop preview launches the app, use the committed `.claude/launch.json`. It still goes through the normal Air Jam dev runner, but adds the preview-managed adapter Claude Preview needs.

For other browser or agent preview tools that ask for a launch command, use `pnpm run dev`. Do not fall back to raw `vite` or a separate preview-only script.

## 3. Play the Game

Open your browser and visit:

[http://localhost:5173](http://localhost:5173)

You should see the Pong template game. You can now:

1.  Open the game in your browser (Host view)
2.  Scan the QR code with your phone (Controller view)
3.  Play the game!

## Optional: HTTPS for Motion Sensors

Most local Air Jam development works on HTTP. Enable HTTPS only when you need secure browser APIs such as gyroscope or motion sensors.

1. Install `mkcert` once on your machine.
2. Initialize secure mode:
   ```bash
   pnpm run secure:init
   ```
3. Run secure dev:
   ```bash
   pnpm run dev -- --secure
   ```

This keeps the local Air Jam server on `http://localhost:4000` and serves the game over trusted local HTTPS.

Optional tunnel fallback:

```bash
pnpm exec airjam secure:init --mode=tunnel --hostname my-game-dev.example.com --tunnel my-game-dev
pnpm run dev -- --secure --secure-mode=tunnel
```

## 4. Customize & Build

This project is "vibecode friendly"—it includes documentation and AI instructions to help you build faster.

- **Check `AGENTS.md`**: Project-wide coding contract and workflow for AI coding assistants.
- **Check `docs/airjam/docs-index.md`**: Canonical local framework references bundled with the template.
- **Modify `src/airjam.config.ts`**: The game declaration: metadata, controls, stores, settings and simulation.
- **Modify `src/game/contracts/input.ts`**: Declare the controls each player has.
- **Use the starter module map in the template `README.md`**: Follow the current starter structure before creating new homes for code.
- **Modify `src/game/stores/`**: Starter location for shared networked state and pure transitions.
- **Modify `src/game/engine/`**: Starter simulation the host advances in fixed steps.
- **Modify `src/host/index.tsx`**: Starter host screen.
- **Modify `src/controller/index.tsx`**: Starter mobile controller surface.
- **Use `tests/game/`**: Starter testing pattern for domain, stores, engine, adapters, and shared game UI.

These paths are the current starter template shape.
They are recommended defaults for new projects, not framework-mandated filenames.

### Connect Your Coding Agent

Use your existing editor, terminal agent, or MCP client; Air Jam does not require
a separate hosted game editor. The generated project includes local instructions
and a portable `.mcp.json` declaration. A declaration is not the same as a client
being connected. Inspect the setup and render the configuration your client uses:

```bash
pnpm exec airjam mcp doctor --dir . --json
pnpm exec airjam mcp config --profile portable --dir .
```

The `codex` and `claude-desktop` profiles render their respective registration
formats. Configuration rendering is read-only: install the rendered entry in
your client, then check its tool discovery. See [For Agents](./for-agents.md)
for semantic game control and a CLI-only path, and
[Supported Agents](./supported-agents.md) for the clients tested end to end.

### Run the Complete Evaluation

Before sharing a game—and again after any repair—run the canonical complete evaluation:

```bash
pnpm exec airjam evaluate --dir .
```

It returns one machine-readable `air-jam-complete-evaluation/v1` document containing the results of typecheck, lint, tests, and the production build. Agents can call the same service through the `airjam.evaluate` MCP action. Individual gates remain available when narrowing a failure.

### Refresh Managed Framework Guidance

Scaffolded projects include an AI pack that owns canonical framework references under `docs/airjam/`. Top-level agent instructions and project-local skills are bootstrap files: after creation, they belong to the project and Air Jam never overwrites them.

Use these commands from your project root:

```bash
pnpm exec airjam ai-pack status --dir .
pnpm exec airjam ai-pack diff --dir .
pnpm exec airjam ai-pack update --dir .
pnpm exec airjam ai-pack repair --dir .
```

`ai-pack update` consumes only the snapshot inside the installed, provenance-backed CLI package. `ai-pack repair` explicitly restores same-version managed drift. Both replace only AI-pack-managed framework references; neither is a merge tool or owns `AGENTS.md`, `CLAUDE.md`, project-local skills, application code, or user-created notes.

### Server not connecting locally

1. Verify `pnpm run dev` is running.
2. Confirm server health: [http://localhost:4000/health](http://localhost:4000/health).
3. Confirm your game is using `http://localhost:4000` for `VITE_AIR_JAM_SERVER_URL` (or no override at all for local defaults).

### Local port already in use

Each parallel agent or project can run an isolated stack without stopping another one:

```bash
AIR_JAM_SERVER_PORT=4400 \
VITE_PORT=5573 \
VITE_AIR_JAM_PUBLIC_HOST=http://127.0.0.1:5573 \
pnpm run dev
```

`pnpm exec airjam topology --mode=standalone-dev` honors the same environment, so the CLI, semantic sessions, QR URL, Vite proxy, and local server stay on one coherent topology.

### App ID errors in deployed environments

1. Ensure `VITE_AIR_JAM_APP_ID` is set in your host platform.
2. Ensure the server URL points at your real Air Jam backend.
3. Ensure your site's exact origin is in the game's allowed origins in Create.
4. Re-copy the App ID from your game's page in Create if the room is refused.

### QR / controller join URL issues

1. Confirm host and controller are on the same room code.
2. If testing on phone outside localhost, set `VITE_AIR_JAM_PUBLIC_HOST` (or use `pnpm run dev -- --secure`).
3. For SPA hosting, ensure rewrites route `/controller?room=XXXX` to your app entry.

## 5. Connect Your Game To Air Jam Services

When you're ready to share your game outside local development, first register
it with Air Jam so the runtime has a stable hosted identity.

1.  **Create a game record**:
    Register your game from the terminal after a one-time browser-assisted login:

    ```bash
    pnpm exec airjam auth login
    pnpm exec airjam game create --dir . --name "My Game" --slug my-game
    pnpm exec airjam game inspect --game my-game
    ```

    Copy the **App ID** from the response. Your game also appears in [Create](/studio)
    at `/studio/games/<id>`, with **Releases**, **Media**, **Analytics** and **Security**.
    Studio projects create their game record on the first release.

2.  **Choose your distribution lane**:
    - Deploy your game to a static hosting provider like Vercel, Netlify, or GitHub Pages.
    - Use that self-hosted URL for normal private review and iteration.
    - If you want public Air Jam Arcade distribution, publish a hosted release artifact in step 6 below.
    - For self-hosted deployments, set the following environment variables:

    ```bash
    VITE_AIR_JAM_APP_ID=your_app_id_here
    VITE_AIR_JAM_SERVER_URL=https://rooms.airjam.io
    ```

Add your site's origin (for example `https://my-game.example`) to the
allowed origins in your game's **Security** section in Create. When your page
opens a room, the SDK asks Air Jam for a short-lived host grant for your App
ID. Air Jam signs one only for an active App ID, asked from one of its allowed
origins exactly, and the grant names that one origin. You do not mint tokens or
add auth code to your game.

The origin check keeps other websites from opening rooms under your App ID in
players' browsers. It is not a secret: a script outside a browser can claim any
origin, just as it can claim any App ID. What bounds misuse is admission: each
game and each account may run 20 hosted rooms at once, inside Air Jam's overall
limit, so rooms someone else opens under your App ID can crowd yours but never
grow past those caps.

On hosted rooms, a crash your game's error boundary catches is also reported to
Air Jam, as its error name and a short digest (never its message, stack or any
player input), so it shows up with your game's other room records. Pass your own
`reportError` to send reports elsewhere.

Before publishing your scaffolded game, run the local checks:

```bash
pnpm test
pnpm run typecheck
pnpm run build
```

If you are self-hosting the client, keep SPA rewrites enabled so `/controller?room=XXXX` resolves to your app entry.

### Self-hosted rooms

Run the open `air-jam-server` yourself and point `VITE_AIR_JAM_SERVER_URL` at
it. In production it needs a gate of your own: compose it with
`createRoomServer({ gate })` from `@air-jam/server/room-server`, or set
`AIR_JAM_AUTH_MODE=disabled` to run it open to any host. Its master key is for
local development and tests only. The SDK sends whatever
`VITE_AIR_JAM_HOST_GRANT_ENDPOINT` returns (`{ "hostGrant": "..." }`) as the
credential when it opens a room, so your gate can verify a token your own
backend signs. Game code stays unchanged.

## 6. Publish A Hosted Arcade Release

The official Arcade hosting lane is now artifact-based. Self-hosted URLs are still useful for private preview, but public Arcade hosting should use a hosted release artifact.

1. Run the local hosted-release preflight from your project root:

```bash
pnpm exec airjam release doctor --dir .
pnpm exec airjam release validate --dir .
```

2. Build a hosted bundle from your project root:

```bash
pnpm exec airjam release bundle --dir .
```

That command:

- runs your build script
- bundles the static output from `dist/`
- writes `.airjam/release-manifest.json`
- creates a hosted release zip under `.airjam/releases/<version>/`

The hosted artifact contract is fixed:

- host entry at `/`
- controller entry at `/controller`

### Terminal or Agent Publishing

The CLI can bundle, upload, and wait for validation. Use the game slug or ID
created in step 5:

```bash
pnpm exec airjam release submit --game my-game --dir . --wait
```

This leaves the processed release unpublished. Inspect the returned release ID,
then explicitly make it live when you are ready:

```bash
pnpm exec airjam release inspect --release <release-id>
pnpm exec airjam release publish --release <release-id>
pnpm exec airjam game media list --game my-game --json
pnpm exec airjam game media assign --game my-game --asset-id <asset-id> --json
pnpm exec airjam game media archive --game my-game --asset-id <asset-id> --json
pnpm exec airjam game update --game my-game --arcade-visibility listed
```

Publishing a release and listing its game are separate decisions. A processing
timeout does not cancel the background job: inspect the same release rather
than submitting another copy. CLI responses retain the release and generation
identities needed to resume work.

`game media list` (also `inspect`) returns existing assets with IDs, kinds,
status and active selections. `assign` reuses an earlier asset for its kind;
`archive` retires one by ID and clears its slot if active. These commands use
the saved machine login and accept `--platform-url` and `--help`. Without
`--json` they print readable output. Use `game media upload` for new files.

### Publish From Create

Alternatively, upload the zip produced by `airjam release bundle` above:

1. Open your game in [Create](/studio) and choose **Releases**.
2. Upload the generated zip artifact.
3. Make the validated release live.
4. Upload thumbnail, cover, and preview media in **Media**.
5. Set the game's Arcade visibility to listed.

Your game is now live in the public Arcade on Air Jam-hosted infrastructure.
