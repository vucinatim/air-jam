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
2. `pnpm dev -- --game=air-capture` for the reference game
3. `pnpm dev -- --game=pong` for the Pong template reference game

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

The default slot exists because both the local Pong template and `air-capture`
use port `5173` by default, so only the reference game you are actively running
should auto-appear without an explicit override.

## Notes

1. Controller chrome in Arcade embedded-game mode follows host-driven session orientation, not just the arcade surface launch hint. See [docs/platform-controller-presentation.md](../../docs/systems/platform-controller-presentation.md).
2. Product architecture and strategy live in [docs/framework-paradigm.md](../../docs/framework-paradigm.md) and [docs/deployment-and-monetization-strategy.md](../../docs/strategy/deployment-and-monetization-strategy.md).

## Website Analytics (Optional)

The platform supports an optional Umami integration for lightweight web analytics.

Set these in `.env.local`:

1. `NEXT_PUBLIC_WEBSITE_ANALYTICS_PROVIDER=umami`
2. `NEXT_PUBLIC_UMAMI_WEBSITE_ID=<your-website-id>`
3. Optional self-host/custom script URL: `NEXT_PUBLIC_UMAMI_SCRIPT_URL=<script-url>`

If `NEXT_PUBLIC_WEBSITE_ANALYTICS_PROVIDER` is not `umami`, no analytics script is injected.

## Hosted Releases Setup

The public Arcade hosted-release and managed-media lanes now share the same storage infrastructure.

Infrastructure requirements:

1. Postgres migrations applied
2. one Cloudflare R2 bucket for release artifacts and game media assets
3. optional screenshot moderation runtime with browser access plus an OpenAI API key

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
2. `OPENAI_API_KEY`
3. `AIRJAM_RELEASES_BROWSER_WS_ENDPOINT` or `AIRJAM_RELEASES_BROWSER_EXECUTABLE_PATH`

Optional:

1. `NEXT_PUBLIC_RELEASES_BASE_URL`
2. `AIRJAM_RELEASES_BASE_URL`

For v1, the simplest setup is to keep hosted releases on the same platform origin and leave the release base URL vars unset.

If screenshot moderation is not configured, hosted releases still publish normally. The release dashboard will record warning checks showing that browser-based moderation was skipped.

## Managed Media

Public game visuals now live in the dedicated `Media` page inside the dashboard.

That page manages:

1. thumbnail image
2. cover image
3. preview video

These assets are uploaded to Air Jam-managed R2 storage and served back through stable platform URLs under `/media/g/{gameId}/{kind}`.

The old raw external media URL fields have been removed from the game model.
