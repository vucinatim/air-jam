# Air Jam Platform

Next.js app for:

1. docs and developer onboarding
2. dashboard and game/app ID management
3. Arcade host and persistent controller runtime

## Local Development

Run the platform from the repo root:

```bash
pnpm run repo -- workspace service platform
```

Platform default URL:

- [http://localhost:3000](http://localhost:3000)

Related local services:

1. `pnpm run repo -- workspace service server` for the realtime server
2. `pnpm arcade:dev --game=air-capture` for the live Arcade reference-game path
3. `pnpm arcade:dev --game=pong` for the live Arcade Pong template path

## Local Arcade Dev Catalog

When the platform runs in development, the Arcade browser can also show repo-local
reference games without pretending they are public hosted releases.

Current behavior:

1. the local Arcade catalog is dev-only
2. by default it exposes `Air Capture` at `http://127.0.0.1:5173`
3. local entries are labeled `Local Dev` in the Arcade grid
4. public Arcade release rules stay unchanged: real public listing still requires a live hosted release

Optional env for local Arcade entries:

1. `NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_DEFAULT=air-capture|pong`
2. `NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_AIR_CAPTURE_URL=http://127.0.0.1:5173`
3. `NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_URL=http://127.0.0.1:4173`
4. `NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_CONTROLLER_URL=http://192.168.0.33:4173/controller`

Use a separate `*_CONTROLLER_URL` when the desktop Arcade should embed the
host surface from `localhost`, but controller phones need the LAN-reachable
controller URL.

## Sentry Error Monitoring (Optional)

The platform supports a minimal Sentry integration for production error monitoring.

Set these in `.env.local` or your hosted environment:

1. `NEXT_PUBLIC_SENTRY_DSN=<project-dsn>`
2. `SENTRY_AUTH_TOKEN=<auth-token-for-source-map-upload>`

If `NEXT_PUBLIC_SENTRY_DSN` is unset, Sentry stays disabled.

The default slot exists because both the local Pong template and `air-capture`
use port `5173` by default, so only the reference game you are actively running
should auto-appear without an explicit override.

## Notes

1. Controller chrome in Arcade embedded-game mode follows host-driven session orientation, not just the arcade surface launch hint. The live shell/runtime rules are covered by [arcade-surface-contract.md](../../docs/contracts/arcade-surface-contract.md) and [composition-shell-contract.md](../../docs/contracts/composition-shell-contract.md).
2. Product architecture and strategy live in [framework-paradigm.md](../../docs/framework-paradigm.md), [platform-control-plane-architecture.md](../../docs/architecture/platform-control-plane-architecture.md), and [deployment-and-monetization-strategy.md](../../docs/strategy/deployment-and-monetization-strategy.md).

## Public Docs And AI Pack Surface

The platform also owns the public docs delivery surface and the hosted AI-pack
delivery surface.

Important public routes:

1. `/docs`
2. `/docs-manifest`
3. `/docs-search-index`
4. `/llms.txt`
5. `/ai-pack/manifest.json`

Reference docs:

1. [platform-docs-surface-architecture.md](../../docs/architecture/platform-docs-surface-architecture.md)
2. [documentation-and-ai-pack-architecture.md](../../docs/architecture/documentation-and-ai-pack-architecture.md)
3. [ai-pack-manifest-contract.md](../../docs/contracts/ai-pack-manifest-contract.md)
4. [ai-pack-workflow-guide.md](../../docs/guides/ai-pack-workflow-guide.md)

## First-Party Product Telemetry

The platform owns a small first-party telemetry plane for approximate public
discovery and product-intent evidence. It does not load an external analytics
script and requires no analytics-provider environment variables.

The browser records canonical page transitions and typed intent actions through
the same-origin `/api/telemetry` route. A server-owned request boundary records
agent-facing resource reach. Collection failures never block navigation, copy
actions, external links, Arcade entry, or public resource responses.

Telemetry is privacy-bounded:

1. anonymous session identity exists only in browser memory
2. no cookies, browser storage, or fingerprinting are used
3. raw IP addresses, full user agents, full URLs, query strings, and raw
   referrers are not persisted
4. production, preview, development, and test traffic stay separable

The internal report at `/dashboard/ops/telemetry` presents product telemetry
beside separately labeled platform lifecycle and runtime usage facts. Product
telemetry is not a source of gameplay, quota, billing, or creator-reward truth.

Apply the platform database migrations before collecting telemetry. The
canonical agent and maintainer surface is discoverable through:

```bash
pnpm run repo -- platform telemetry --help
```

It exposes stable JSON reads and the full maintenance lifecycle:

```bash
pnpm --silent run repo -- platform telemetry overview --days 30 --environment production --json
pnpm --silent run repo -- platform telemetry health --json
pnpm --silent run repo -- platform telemetry rebuild --json
pnpm --silent run repo -- platform telemetry rebuild --apply --json
pnpm --silent run repo -- platform telemetry retain --json
pnpm --silent run repo -- platform telemetry retain --apply --json
```

`overview` returns the same authority-separated report used by the ops UI.
`health` inspects storage, projection, and retention state. Rebuild and retention
are read-only previews unless `--apply` is explicit. All commands use
`DATABASE_URL` from the environment or `apps/platform/.env.local`; they do not
embed or print database credentials.

Agents can operate an explicit hosted environment without manually extracting
its database secret:

```bash
pnpm --silent run repo -- platform telemetry health \
  --railway-environment <environment-id> \
  --railway-project <project-id> \
  --json
```

`--railway-project` may be omitted when `RAILWAY_PROJECT_ID` is configured. The
repo command resolves the environment PostgreSQL connection internally and
passes it only to the telemetry subprocess.

Reference docs:

1. [product-telemetry-architecture.md](../../docs/architecture/product-telemetry-architecture.md)
2. [product-telemetry-contract.md](../../docs/contracts/product-telemetry-contract.md)

## Hosted Releases Setup

The public Arcade hosted-release and managed-media lanes now share the same storage infrastructure.

Infrastructure requirements:

1. Postgres migrations applied
2. one Cloudflare R2 bucket for release artifacts and game media assets
3. screenshot moderation runtime with browser access
4. optional OpenAI image moderation when you want automated image-policy enforcement
5. one separately deployed platform release-job worker

The database migrations have already been added under [drizzle](./drizzle) and can be applied with:

```bash
pnpm --filter platform exec drizzle-kit migrate --config drizzle.config.ts
```

Environment variables for the hosted release lane are documented in [`.env.example`](./.env.example).

Minimum additional env needed for storage:

1. `AIRJAM_RELEASES_R2_BUCKET`
2. `AIRJAM_RELEASES_R2_ACCOUNT_ID` or `AIRJAM_RELEASES_R2_ENDPOINT`
3. `AIRJAM_RELEASES_R2_ACCESS_KEY_ID`
4. `AIRJAM_RELEASES_R2_SECRET_ACCESS_KEY`

Optional env for screenshot moderation:

1. `AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN`
2. `AIRJAM_RELEASES_BROWSER_WS_ENDPOINT` plus `AIRJAM_RELEASES_BROWSER_ACCESS_TOKEN`, or `AIRJAM_RELEASES_BROWSER_EXECUTABLE_PATH`; the Railway worker endpoint uses the stable shape `wss://<worker-domain>/ws`
3. `AIRJAM_RELEASES_IMAGE_MODERATION_MODE=openai|disabled`
4. `OPENAI_API_KEY` when `AIRJAM_RELEASES_IMAGE_MODERATION_MODE=openai`

The long-running release executor starts with:

```bash
pnpm --filter platform worker
```

Production uses the bundled `worker:start` entry and
[`railway.worker.json`](./railway.worker.json). Configure a strong
`AIRJAM_PLATFORM_WORKER_CONTROL_TOKEN`; `/health` is liveness, `/ready` proves
recent PostgreSQL authority, and authenticated `POST /drain` stops new claims
before deploy termination.

Agents and maintainers inspect and safely operate the same authority through:

```bash
pnpm --silent run repo -- platform operations jobs --help
```

Optional:

1. `NEXT_PUBLIC_RELEASES_BASE_URL`
2. `AIRJAM_RELEASES_BASE_URL`

For v1, the simplest setup is to keep hosted releases on the same platform origin and leave the release base URL vars unset.

If screenshot moderation is not configured, its durable job fails closed. The
release remains failed until the runtime is available and an operator replays
the terminal job, which keeps platform policy aligned with server-side checks.

If screenshot moderation is configured but `AIRJAM_RELEASES_IMAGE_MODERATION_MODE=disabled`, the platform still captures the canonical screenshot and records an `image_moderation` warning check, but the release can become `ready`. That mode is intended for local or other non-production environments where you want deterministic release QA without making OpenAI moderation a hard requirement.

## Managed Media

Public game visuals now live in the dedicated `Media` page inside the dashboard.

That page manages:

1. thumbnail image
2. cover image
3. preview video

These assets are uploaded to Air Jam-managed R2 storage and served back through stable platform URLs under `/media/g/{gameId}/{kind}`.

The old raw external media URL fields have been removed from the game model.
