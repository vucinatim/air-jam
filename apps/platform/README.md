# Air Jam Platform

Next.js app for:

1. docs and developer onboarding
2. dashboard and game/app ID management
3. Arcade host and persistent controller runtime

## Local Development

Run the platform from the repo root:

```bash
pnpm dev:platform
```

Platform default URL:

- [http://localhost:3000](http://localhost:3000)

Related local services:

1. `pnpm dev:server` for the realtime server
2. `pnpm dev:prototype-game` for the reference game

## Notes

1. Controller chrome in Arcade embedded-game mode follows host-driven session orientation, not just the arcade surface launch hint. See [docs/platform-controller-presentation.md](../../docs/platform-controller-presentation.md).
2. Product architecture and strategy live in [docs/framework-paradigm.md](../../docs/framework-paradigm.md) and [docs/deployment-and-monetization-strategy.md](../../docs/deployment-and-monetization-strategy.md).
