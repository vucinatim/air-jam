# Air Jam

**Turn smartphones into game controllers.** Air Jam is an open-source platform for building multiplayer games where computers/TVs act as the host display and smartphones become game controllers—no app downloads required.

## What is Air Jam?

Air Jam enables developers to create **"AirConsole-style" multiplayer games** with minimal setup. Players simply scan a QR code to join, and their phones instantly become controllers. Perfect for:

- 🎮 Party games and local multiplayer experiences
- 🏢 Interactive installations and events
- 🎓 Educational games and workshops
- 🎪 Arcade-style gaming experiences

### Key Features

- **Zero App Download**: Players join by scanning a QR code—no app store required
- **Instant Multiplayer**: Seamlessly connect up to 8 smartphones as controllers
- **Developer Friendly**: Built with modern web technologies (React, TypeScript)
- **Type Safe**: End-to-end type safety with Zod schema validation
- **Performance Optimized**: Latching system ensures no input is ever missed
- **Haptic Feedback**: Send vibration patterns to controllers for game events
- **Real-time Communication**: WebSocket-based server for low-latency gameplay

## Project Structure

This is a monorepo managed with pnpm workspaces:

```
air-jam/
├── apps/
│   └── platform/           # Next.js platform web app (developer portal, game catalog)
├── games/
│   ├── air-capture/        # Advanced first-party reference game
│   ├── pong/               # Canonical starter game
│   └── ...                 # Additional repo-owned games and showcase imports
├── packages/
│   ├── sdk/                # Core SDK for building games (@air-jam/sdk)
│   ├── server/             # WebSocket server for game connections
│   └── create-airjam/      # CLI tool to scaffold new games
```

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/vucinatim/air-jam.git
cd air-jam

# Install dependencies
pnpm install
```

### Development

#### Running The Full Local Stack

Use the top-level workspace launcher for the common local flow:

```bash
# Start sdk watch, server, platform app, and air-capture
pnpm dev

# Start the same stack with a specific repo-owned game
pnpm dev -- --game=pong
pnpm dev -- --game=code-review

# Start the stack and also open Drizzle Studio
pnpm dev -- --db-studio

# Stable local Arcade integration testing
pnpm arcade:test -- --game=code-review

# Secure local Arcade when a game needs secure browser APIs
pnpm secure:init
pnpm arcade:test -- --game=code-review --secure
```

The output is prefixed by process name, so server logs remain visible in the shared terminal.
`pnpm dev` intentionally starts the platform app only; run Drizzle Studio explicitly when you need database inspection.
Use `pnpm dev` for fast direct Vite iteration. Use `pnpm arcade:test` when you need the game running inside real Arcade with host/controller validation.
Secure local Arcade uses trusted local HTTPS via `mkcert`.

If you need tunnel fallback for a standalone game dev server, use the game-local scripts instead:

```bash
cd games/code-review
pnpm secure:init -- --mode=tunnel --hostname my-game-dev.example.com --tunnel my-game-dev
pnpm dev -- --secure --secure-mode=tunnel
```

#### Running the Platform

The platform includes the developer portal, game catalog, and documentation:

```bash
# Run only the platform app through the repo CLI
pnpm run repo -- workspace service platform

# Or run platform-specific commands directly
pnpm --filter platform dev:no-db
pnpm --filter platform dev:db
```

**Environment Variables** (create `.env.local` in `apps/platform/`):

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/airjam

# Authentication (BetterAuth)
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret

# Server connection
NEXT_PUBLIC_AIR_JAM_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_AIR_JAM_APP_ID=aj_app_your_platform_app_id

# Optional stronger signed host-grant mode
NEXT_PUBLIC_AIR_JAM_HOST_GRANT_ENDPOINT=/api/airjam/host-grant
```

#### Running the Development Server

The server handles WebSocket connections for games:

```bash
# Start only the server (runs on http://localhost:4000)
pnpm run repo -- workspace service server
```

**Environment Variables** (create `.env` in `packages/server/`):

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/airjam

# Optional stronger signed host-grant mode
AIR_JAM_HOST_GRANT_SECRET=your-signing-secret
```

If you set `AIR_JAM_AUTH_MODE=required`, the server now fails fast on boot unless at least one auth backend is configured:

- `DATABASE_URL` for static `appId` bootstrap
- `AIR_JAM_HOST_GRANT_SECRET` for signed host grants
- `AIR_JAM_MASTER_KEY` only as a legacy fallback

#### Running the Prototype Game

Reference implementation showcasing SDK capabilities:

```bash
# Start the workspace stack with air-capture selected
pnpm dev -- --game=air-capture
```

### Building a Game

The easiest way to create a new game is using the CLI:

```bash
npx create-airjam my-game
npx create-airjam my-game --template=pong
npx create-airjam my-game --template=air-capture
cd my-game
pnpm install
```

This scaffolds a complete project with:

- A real source-game template such as `pong` or `air-capture`
- Local development server setup
- SDK configuration
- Documentation and AI instructions

### Internal Template Workflow

Inside this monorepo, scaffoldable games now live under `games/` as normal source
games, and `create-airjam` exports them through one shared pipeline.

The canonical workflow is:

- Develop scaffoldable games in-place under `games/`.
- Use `pnpm test:scaffold` to prove all scaffoldable games export cleanly against local packages.
- Use `pnpm test:scaffold:tarball` to prove scaffolds work against packed unpublished artifacts.
- Use `pnpm run repo -- pack local` to produce local tarballs under `.airjam/tarballs/`.

Useful local scaffold helpers:

```bash
pnpm run repo -- scaffold local my-local-game --source workspace
pnpm run repo -- scaffold local my-local-game --source workspace --template air-capture
pnpm run repo -- scaffold local ../scratch/my-airjam-game --source tarball
```

Repo-only maintenance helpers now live behind the internal workspace CLI:

```bash
pnpm run repo -- --help
```

That keeps game source, scaffold generation, workspace development, and pre-publish
verification on one path instead of relying on duplicate template trees or hidden
publish-time rewrites.

See the [SDK README](./packages/sdk/README.md) for detailed usage.

## Contributing

We welcome contributions! Here's how you can help:

Full contribution workflow and standards: [CONTRIBUTING.md](./CONTRIBUTING.md)

### Submitting a Pull Request

1. Ensure all checks pass (`pnpm check:release`)
2. Write clear commit messages
3. Update documentation if needed
4. Submit a PR with a clear description of changes

### Release Validation

Run the canonical release check before shipping:

```bash
pnpm check:release
```

That includes:

- workspace typechecks
- automated tests
- workspace builds
- a lightweight happy-path smoke flow

If you only want the smoke flow:

```bash
pnpm smoke:happy-path
```

### Optional Local Perf Sanity

Run a lightweight server benchmark locally (not CI-gated):

```bash
pnpm run repo -- perf sanity
```

Optional flags:

- `--controllers=<n>` (default `8`)
- `--hz=<n>` events/sec per controller (default `30`)
- `--durationMs=<n>` measurement duration in ms (default `90000`)
- `--warmupMs=<n>` warmup duration in ms (default `3000`)
- `--strict` to return non-zero exit when soft thresholds are exceeded

### Areas for Contribution

- 🐛 Bug fixes
- ✨ New features for the SDK
- 📚 Documentation improvements
- 🎨 UI/UX enhancements for the platform
- 🧪 Test coverage
- 🌐 Internationalization
- 🎮 Example games and templates

## Deployment

### Platform Deployment

The platform is a Next.js application that can be deployed to Vercel, Railway, or any Node.js hosting provider.

#### Deploying to Vercel

1. **Connect your repository** to Vercel
2. **Set root directory** to `apps/platform`
3. **Configure environment variables**:
   - `DATABASE_URL`: PostgreSQL connection string
   - `BETTER_AUTH_SECRET`: Random secret for authentication
   - `BETTER_AUTH_URL`: Your production URL (e.g., `https://your-domain.com`)
   - `GITHUB_CLIENT_ID`: GitHub OAuth app client ID
   - `GITHUB_CLIENT_SECRET`: GitHub OAuth app client secret
   - `NEXT_PUBLIC_AIR_JAM_SERVER_URL`: Your server URL (e.g., `https://server.your-domain.com`)
   - `NEXT_PUBLIC_AIR_JAM_APP_ID`: Your platform App ID
   - `NEXT_PUBLIC_AIR_JAM_HOST_GRANT_ENDPOINT`: Optional signed host-grant endpoint for stricter host auth

4. **Build settings**:
   - Framework Preset: Next.js
   - Build Command: `cd ../.. && pnpm install && pnpm --filter platform build`
   - Output Directory: `.next`

Use the package build command, not raw `next build`. The platform build generates content sources and hosted AI-pack artifacts as part of the build.

#### Database Setup

The platform requires PostgreSQL. You can use:

- **Railway**: Easy PostgreSQL setup
- **Vercel Postgres**: Integrated with Vercel deployments
- **Supabase**: Free tier available
- **Neon**: Serverless Postgres

After setting up the database, run migrations:

```bash
cd apps/platform
pnpm drizzle-kit push
```

#### Minimal Backup Posture

For prerelease use, Air Jam keeps the backup posture intentionally simple:

```bash
pnpm run repo -- platform db-backup
```

This writes a local custom-format `pg_dump` export into `backups/platform/`.

It uses:

1. `DATABASE_URL` from your shell, if set
2. otherwise `apps/platform/.env.local`
3. otherwise `apps/platform/.env`

This is not a full backup system. It is the minimum reliable manual export path for the platform database until a stronger managed-backup posture is justified.

#### Server Deployment

The server can be deployed as a Node.js application:

1. **Build the server**:

   ```bash
   cd packages/server
   pnpm build
   ```

2. **Deploy to Railway/Render/Fly.io**:
  - Set `DATABASE_URL` for app ID lookup and optional origin policy
  - Optionally set `AIR_JAM_HOST_GRANT_SECRET` if you want signed host-grant mode
   - (Optional) Set `AIR_JAM_ALLOWED_ORIGINS` to your app domains
   - Set `PORT` (defaults to 4000)
   - Run `node dist/cli.js` or `pnpm start`

3. **Or use the npm package**:
   ```bash
   npm install -g @air-jam/server
   air-jam-server
   ```

#### Environment Variables Summary

**Platform** (`apps/platform`):

- `DATABASE_URL`: PostgreSQL connection
- `BETTER_AUTH_SECRET`: Auth secret
- `BETTER_AUTH_URL`: Production URL
- `GITHUB_CLIENT_ID`: GitHub OAuth app client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth app client secret
- `NEXT_PUBLIC_AIR_JAM_SERVER_URL`: Server URL
- `NEXT_PUBLIC_AIR_JAM_APP_ID`: Public app ID for platform host bootstrap
- `NEXT_PUBLIC_AIR_JAM_HOST_GRANT_ENDPOINT`: Optional signed host-grant endpoint

**Server** (`packages/server`):

- `DATABASE_URL`: PostgreSQL connection (enables app ID lookup and optional origin policy)
- `AIR_JAM_AUTH_MODE`: `disabled` | `required` (default auto: disabled in local dev, required in production)
- `AIR_JAM_HOST_GRANT_SECRET`: Optional secret for stronger signed host-grant mode
- `AIR_JAM_ALLOWED_ORIGINS`: Optional comma-separated CORS allowlist (default `*`)
- `AIR_JAM_RATE_LIMIT_WINDOW_MS`: Optional rate-limit window in ms (default: `60000`)
- `AIR_JAM_HOST_REGISTRATION_RATE_LIMIT_MAX`: Optional max host registration attempts per window (default: `30`)
- `AIR_JAM_STATIC_APP_RATE_LIMIT_MAX`: Optional max bootstrap/lifecycle attempts per app+origin scope in static mode (default: `120`)
- `AIR_JAM_CONTROLLER_JOIN_RATE_LIMIT_MAX`: Optional max controller joins per window (default: `120`)
- `AIR_JAM_LOG_LEVEL`: Optional server log level (`fatal` | `error` | `warn` | `info` | `debug` | `trace`, default: `info`)
- `AIR_JAM_DEV_LOG_COLLECTOR`: Optional unified dev log collector mode (`enabled` | `disabled`, default: enabled outside production)
- `AIR_JAM_DEV_LOG_DIR`: Optional unified dev log output directory (default: `./.airjam/logs`, canonical file: `dev-latest.ndjson`)
- `PORT`: Server port (default: 4000)

#### Dev Log Viewer

When the dev log collector is enabled, the server writes the canonical local debug stream to:

- `.airjam/logs/dev-latest.ndjson`

Use the built-in viewer to inspect it:

```bash
pnpm run repo -- workspace logs
pnpm exec air-jam-server logs --follow
pnpm exec air-jam-server logs --trace=host_abc123
pnpm exec air-jam-server logs --source=browser --level=warn
```

### Game Deployment

Games built with Air Jam are static web applications. Deploy to:

- **Vercel**: Connect your game repository
- **Netlify**: Drag and drop or Git integration
- **GitHub Pages**: Free hosting for open-source games
- **Cloudflare Pages**: Fast global CDN

Set environment variables:

- `VITE_AIR_JAM_SERVER_URL` or `NEXT_PUBLIC_AIR_JAM_SERVER_URL`: Your server URL
- `VITE_AIR_JAM_APP_ID` or `NEXT_PUBLIC_AIR_JAM_APP_ID`: Your public app ID

### Published Game Media

For v1, published game listing media is URL-based.

If you want thumbnails, cover images, or preview videos in the dashboard and Arcade browser, the intended flow is:

1. host those files yourself with the game deployment
2. keep them in the game's public static assets, for example `public/media/`
3. paste the deployed absolute URLs into the game settings in the Air Jam dashboard

Example:

- `https://your-game.vercel.app/media/thumbnail.jpg`
- `https://your-game.vercel.app/media/cover.jpg`
- `https://your-game.vercel.app/media/preview.mp4`

Air Jam does not manage media uploads yet. That is intentional for v1 so game publishing stays simple and the platform does not need a full asset-storage product before release.

## Documentation

- **[Project Docs Index](./docs/docs-index.md)**: Planning, workflow, and supporting docs
- **[Performance Baseline](./docs/strategy/performance-baseline.md)**: Optional local perf sanity snapshots
- **[SDK Documentation](./packages/sdk/README.md)**: Complete SDK reference
- **[Platform Docs](./apps/platform/src/app/docs/)**: Full documentation in the platform app
- **[Architecture Guide](./apps/platform/src/app/docs/how-it-works/architecture/page.mdx)**: System design overview

## Project Policies

- **[CONTRIBUTING.md](./CONTRIBUTING.md)**: Contribution workflow and quality expectations
- **[LICENSE](./LICENSE)**: Project license terms
- **[SECURITY.md](./SECURITY.md)**: Vulnerability reporting and security policy
- **[AGENTS.md](./AGENTS.md)**: General engineering contract for coding agents

## License

[MIT License](./LICENSE)

## Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/vucinatim/air-jam/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/vucinatim/air-jam/discussions)
- 📧 **Email**: tim.vucina@gmail.com

## Acknowledgments

Built with:

- [React](https://react.dev/)
- [Next.js](https://nextjs.org/)
- [Socket.IO](https://socket.io/)
- [TypeScript](https://www.typescriptlang.org/)
- [Zod](https://zod.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)

---

**Made with ❤️ by the Air Jam community**
