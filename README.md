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
│   ├── platform/           # Next.js platform web app (developer portal, game catalog)
│   └── prototype-game/     # Reference game implementation
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

#### Running the Platform

The platform includes the developer portal, game catalog, and documentation:

```bash
# Start the platform (runs on http://localhost:3000)
pnpm dev:platform
```

**Environment Variables** (create `.env.local` in `apps/platform/`):

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/airjam

# Authentication (BetterAuth)
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000

# Server connection
NEXT_PUBLIC_AIR_JAM_SERVER_URL=http://localhost:4000
```

#### Running the Development Server

The server handles WebSocket connections for games:

```bash
# Start the server (runs on http://localhost:4000)
pnpm dev:server
```

**Environment Variables** (create `.env` in `packages/server/`):

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/airjam

# Production mode (requires API key authentication)
AIR_JAM_MASTER_KEY=your-master-key  # Optional for dev mode
```

#### Running the Prototype Game

Reference implementation showcasing SDK capabilities:

```bash
# Start the prototype game
pnpm dev:prototype-game
```

### Building a Game

The easiest way to create a new game is using the CLI:

```bash
npx create-airjam my-game
cd my-game
pnpm install
```

This scaffolds a complete project with:
- Working Pong game template
- Local development server setup
- SDK configuration
- Documentation and AI instructions

See the [SDK README](./packages/sdk/README.md) for detailed usage.

## Contributing

We welcome contributions! Here's how you can help:

### Submitting a Pull Request

1. Ensure all checks pass (`pnpm typecheck`, `pnpm lint`, `pnpm build`)
2. Write clear commit messages
3. Update documentation if needed
4. Submit a PR with a clear description of changes

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
   - `NEXT_PUBLIC_AIR_JAM_SERVER_URL`: Your server URL (e.g., `https://server.your-domain.com`)
   - `AIR_JAM_MASTER_KEY`: Master key for server authentication (optional)

4. **Build settings**:
   - Framework Preset: Next.js
   - Build Command: `cd ../.. && pnpm install && pnpm --filter platform build`
   - Output Directory: `.next`

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

#### Server Deployment

The server can be deployed as a Node.js application:

1. **Build the server**:
   ```bash
   cd packages/server
   pnpm build
   ```

2. **Deploy to Railway/Render/Fly.io**:
   - Set `DATABASE_URL` environment variable
   - Set `AIR_JAM_MASTER_KEY` for production mode
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
- `NEXT_PUBLIC_AIR_JAM_SERVER_URL`: Server URL

**Server** (`packages/server`):
- `DATABASE_URL`: PostgreSQL connection
- `AIR_JAM_MASTER_KEY`: Master key (required for production)
- `PORT`: Server port (default: 4000)

### Game Deployment

Games built with Air Jam are static web applications. Deploy to:

- **Vercel**: Connect your game repository
- **Netlify**: Drag and drop or Git integration
- **GitHub Pages**: Free hosting for open-source games
- **Cloudflare Pages**: Fast global CDN

Set environment variables:
- `VITE_AIR_JAM_SERVER_URL` or `NEXT_PUBLIC_AIR_JAM_SERVER_URL`: Your server URL
- `VITE_AIR_JAM_API_KEY` or `NEXT_PUBLIC_AIR_JAM_API_KEY`: Your API key (from platform dashboard)

## Documentation

- **[SDK Documentation](./packages/sdk/README.md)**: Complete SDK reference
- **[Platform Docs](./apps/platform/src/app/docs/)**: Full documentation in the platform app
- **[Architecture Guide](./apps/platform/src/app/docs/how-it-works/architecture/page.mdx)**: System design overview

## License

MIT License

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
