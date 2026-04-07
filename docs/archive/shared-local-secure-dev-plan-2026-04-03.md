# Shared Local Secure Dev Plan

Last updated: 2026-04-03  
Status: completed baseline

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Monorepo Operating System](../monorepo-operating-system.md)
3. [Game Source Scaffolding Plan](./game-source-scaffolding-plan-2026-04-07.md)
4. [ZeroDays Game Import And Template Promotion Plan](./zerodays-game-import-template-promotion-plan-2026-04-07.md)

## Purpose

Replace the old Cloudflare-tunnel-first secure testing workflow with a cleaner local HTTPS model that works for:

1. repo games under `games/`
2. local Arcade through the platform
3. exported `create-airjam` projects

The clean default is trusted local HTTPS via `mkcert`, with Cloudflare tunnel kept only as an explicit fallback mode for standalone game dev.

## Current Baseline

The baseline implementation is now in:

1. the secure developer contract is now intentionally split by workflow:
   1. repo-local Arcade integration: `pnpm secure:init` then `pnpm arcade:test -- --game=<id> --secure`
   2. exported or standalone games: `pnpm secure:init` then direct secure game dev
2. the shared secure runtime now lives in `packages/create-airjam/runtime/`
3. root workspace secure Arcade now uses the stable local-build route via `pnpm arcade:test -- --game=<id> --secure`
4. local secure Arcade now serves built repo games through `/airjam-local-builds/<game>/` on the platform origin
5. repo games consume a shared router-basename contract so platform-served Arcade routes do not require per-game URL hacks
6. all repo-owned games now consume the same shared Vite HTTPS contract instead of per-game secure helpers
7. exported `create-airjam` projects now inherit the same secure-init and secure-dev contract as repo games
8. Cloudflare tunnel remains available only when a user explicitly selects `--mode=tunnel`
9. `cloudflared` is no longer a default template dependency

## Core Position

Air Jam should have one happy path for secure local browser APIs in Arcade:

1. install `mkcert` once on the machine
2. run `pnpm secure:init`
3. run `pnpm arcade:test -- --game=<id> --secure`

Direct standalone game dev remains a separate workflow for fast iteration.

## Desired End State

The repo and exported projects should now teach the same secure workflow:

1. repo-local Arcade now runs through a single browser origin over trusted local HTTPS
2. exported games use the same script contract and environment surface
3. secure-only browser APIs work locally without requiring external infrastructure
4. phone-on-LAN testing no longer depends on live Vite proxying during local Arcade use
5. Cloudflare tunnel is optional fallback infrastructure, not the default story

## Implemented Contract

### 1. Commands

The canonical commands are:

```bash
pnpm secure:init
pnpm arcade:test -- --game=code-review --secure
```

Direct secure game dev still exists separately:

```bash
cd games/code-review
pnpm secure:init -- --mode=tunnel --hostname my-game-dev.example.com --tunnel my-game-dev
pnpm dev:secure -- --secure-mode=tunnel
```

### 2. Shared Secure State

Secure local state now lives under `.airjam/`:

1. `.airjam/certs/` for generated certificate material
2. `.airjam/secure-dev.json` for persisted secure-dev metadata

The shared secure env surface is:

1. `AIR_JAM_SECURE_MODE`
2. `AIR_JAM_SECURE_PUBLIC_HOST`
3. `AIR_JAM_DEV_CERT_FILE`
4. `AIR_JAM_DEV_KEY_FILE`

### 3. Workspace Secure Arcade

In root workspace secure mode:

1. the platform owns the only browser-facing origin on `:3000`
2. the selected game is built once and served under `/airjam-local-builds/<game>/`
3. the backend server remains on local HTTP behind the existing app proxy behavior
4. fast HMR stays on the separate direct `pnpm dev` workflow instead of being forced through Arcade

### 4. Template Consistency

`create-airjam` now exports the same secure contract that the repo uses directly.

That means:

1. no duplicated per-game secure helper implementations
2. no default `cloudflared` dependency in generated projects
3. no secure workflow drift between repo games and scaffolded games

## Validation Baseline

The secure-dev baseline is now covered by:

1. `pnpm --filter create-airjam test`
2. `pnpm --filter create-airjam build`
3. `pnpm typecheck`
4. `pnpm test:scaffold`

The scaffold sweep now proves that exported games still install, typecheck, test, and build after inheriting the new shared secure-dev contract.

## Follow-Up Boundary

This plan is done enough for the current repo shape.

Any future work here should be treated as polish or deeper productization, for example:

1. additional secure-dev CLI ergonomics
2. richer automated verification of local HTTPS bootstrap on machines that already have `mkcert`
3. post-release UX polish around phone trust guidance
