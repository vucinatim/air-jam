# Deployment Topology

Last updated: 2026-05-06
Status: canonical topology

This document defines the intended production topology for Air Jam and the cleanup path from the current state to a more deterministic deployment system.

## Goal

Production should be explicit and boring.

That means:

1. each production service has one clear responsibility
2. each service has one clear source path in the repo
3. build and start commands are explicit
4. required environment variables are explicit
5. cross-service dependencies are explicit
6. release publishing should not depend on hidden fallbacks or platform guesswork

## Canonical Topology

Air Jam production should be split into four surfaces:

1. `Vercel` for the platform app
2. `Railway` for the realtime/API server
3. `Railway` or an equivalent long-lived runtime for release screenshot capture and image moderation
4. `R2` for hosted release artifacts and managed media

That split matches the actual workload boundaries:

1. the platform app is a public Next.js web surface
2. the realtime server is a long-lived websocket and room-lifecycle process
3. screenshot capture and moderation require a stateful browser runtime and should not be coupled to the realtime server
4. release artifacts and media should stay externalized

## Service Ownership

### 1. Platform App

Provider: `Vercel`  
Repo ownership: `apps/platform`

Responsibilities:

1. landing page
2. Arcade
3. dashboard
4. auth flows
5. hosted release submission/finalize/publish orchestration
6. managed media routes

Should not own:

1. long-lived realtime socket handling
2. screenshot browser runtime
3. direct release artifact storage

Current public origins:

1. `https://airjam.io`
2. `https://www.airjam.io`

Important env ownership:

1. `NEXT_PUBLIC_AIR_JAM_SERVER_URL`
2. `NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST`
3. `BETTER_AUTH_URL`
4. `BETTER_AUTH_SECRET`
5. GitHub auth credentials
6. release storage env
7. release moderation env

### 2. Realtime/API Server

Provider: `Railway`  
Repo ownership: `packages/server`

Responsibilities:

1. websocket/session lifecycle
2. room creation and bootstrap
3. host/controller traffic
4. authoritative multiplayer coordination
5. server-side auth validation for multiplayer access

Should not own:

1. platform page rendering
2. screenshot capture
3. release moderation browser processes
4. managed media presentation

Current public origin:

1. `https://api.airjam.io`

Recommended build contract:

1. install from repo root with workspace awareness
2. build with explicit pnpm workspace filtering
3. start only the server package

Recommended commands:

```bash
pnpm install --frozen-lockfile
pnpm --filter @air-jam/server... build
pnpm --filter @air-jam/server start
```

Config-as-code path:

1. `/packages/server/railway.json`

### 3. Release Screenshot / Moderation Worker

Provider: `Railway` or equivalent long-lived process host  
Repo ownership: `packages/release-browser-worker`

Responsibilities:

1. open hosted release URLs in a real browser
2. capture release screenshots during finalize/publish
3. support image moderation evaluation

Should not own:

1. websocket gameplay runtime
2. platform page rendering
3. release artifact persistence

This is a first-class production subsystem, not a side effect of the platform app.

The platform should talk to it through one explicit browser endpoint:

1. `AIRJAM_RELEASES_BROWSER_WS_ENDPOINT`

Worker access should now also be treated as an explicit auth boundary:

1. the worker should expose only discovery/health routes unauthenticated
2. proxied HTTP/WebSocket browser access should require a bearer token
3. the platform should provide that token through `AIRJAM_RELEASES_BROWSER_ACCESS_TOKEN`

The repo now includes a dedicated worker package and Dockerfile for this role:

1. package: `packages/release-browser-worker`
2. Dockerfile: `packages/release-browser-worker/Dockerfile`
3. Railway config-as-code: `/packages/release-browser-worker/railway.json`

### 4. Storage

Provider: `R2`

Responsibilities:

1. hosted release bundles
2. release assets
3. managed media for thumbnail / cover / preview video

Storage should remain dumb infrastructure. Presentation and access policy stay in the platform app.

## Current Production State

Current live shape:

1. `Vercel` hosts the platform app
2. `Railway` hosts the realtime server and Postgres
3. `R2` is used for release/media storage
4. release screenshot/moderation runtime is not yet properly provisioned as a production subsystem

This means the overall topology direction is correct, but the operational clarity is not complete yet.

One important current fact from the preview rollout:

1. the repo now has service-level config-as-code for both the realtime server and the release browser worker
2. the live Railway project still needs those config-as-code paths pinned explicitly in the provider so preview and production deploys stop depending on the currently stored service build configuration

## Current Problems

The main issues are not the provider choices. The issues are implicit deployment contracts.

### 1. Too Much Platform Guessing

We already hit production issues caused by hidden fallback behavior, for example:

1. public host resolution falling back to `VERCEL_URL`
2. QR/controller URLs being generated from the wrong host when `NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST` was missing

That is a sign that important deployment identity is still too implicit.

### 2. Release Moderation Is Not Yet A Real Service

Hosted release publishing currently depends on browser screenshot capability, but that browser runtime is not yet deployed as a dedicated production unit.

As a result:

1. release doctor and artifact validation can pass
2. release finalize/publish can still fail
3. the failure mode is operational rather than game-specific

### 3. Realtime Deploy Truth Needs To Be Easier To Audit

The realtime server deploy path should be easy to explain in one sentence:

1. what repo path it builds from
2. what commands it runs
3. what env it needs
4. when it redeploys

If any of that requires memory or dashboard archaeology, the setup is not clean enough.

## Clean Production Contract

The intended production contract is:

1. `Vercel` owns only `apps/platform`
2. `Railway` owns only the realtime/API server process plus Postgres
3. a dedicated browser worker owns only screenshot/moderation browser runtime
4. `R2` owns only release/media object storage

No production capability should depend on one service accidentally doing another service's job.

## Environment Ownership Matrix

### Platform App Env

Platform-only env should include at least:

1. `NEXT_PUBLIC_AIR_JAM_SERVER_URL`
2. `NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST`
3. `BETTER_AUTH_URL`
4. `BETTER_AUTH_SECRET`
5. `GITHUB_CLIENT_ID`
6. `GITHUB_CLIENT_SECRET`
7. `DATABASE_URL`
8. `AIR_JAM_MASTER_KEY`
9. `AIRJAM_RELEASES_R2_BUCKET`
10. `AIRJAM_RELEASES_R2_ACCOUNT_ID` or `AIRJAM_RELEASES_R2_ENDPOINT`
11. `AIRJAM_RELEASES_R2_ACCESS_KEY_ID`
12. `AIRJAM_RELEASES_R2_SECRET_ACCESS_KEY`
13. `AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN`
14. `AIRJAM_RELEASES_BROWSER_WS_ENDPOINT`
15. `OPENAI_API_KEY` when image moderation is enabled

### Realtime Server Env

Server-only env should include at least:

1. `DATABASE_URL`
2. `AIR_JAM_MASTER_KEY`
3. `AIR_JAM_AUTH_MODE`
4. `AIR_JAM_ALLOWED_ORIGINS`

The realtime server should not need the platform's release-storage or moderation env.

### Browser Worker Env

Worker-specific env should be limited to whatever the browser service needs to run safely, such as:

1. browser process settings
2. optional access token or shared secret for callers
3. any worker-level observability config

The worker should not need database or multiplayer env unless a later design explicitly makes that necessary.

## Recommended Hardening Path

### Phase 1. Freeze The Contract

Document and audit the current live shape:

1. service list
2. public URLs
3. repo ownership
4. build/start commands
5. env ownership
6. dependency edges

This document is the first step of that freeze.

### Phase 2. Make Existing Services Deterministic

For `Vercel`:

1. keep `apps/platform` as the only root
2. explicitly document all required production env
3. avoid relying on fallback host resolution in production

For `Railway` realtime:

1. keep one service for the realtime/API server
2. build from repo root with explicit workspace commands
3. keep env ownership narrow and server-specific
4. keep `main` autodeploy, but only after the service contract is pinned clearly

### Phase 3. Extract Browser Moderation Into A Real Subsystem

Stand up a dedicated browser runtime and wire:

1. `AIRJAM_RELEASES_BROWSER_WS_ENDPOINT`
2. `AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN`
3. moderation-specific env

This is the key step that turns hosted release publishing into a reliable production lane.

### Phase 4. Add Operational Guardrails

Add one lightweight smoke procedure that verifies:

1. platform app is reachable
2. realtime API health is reachable
3. Arcade connects
4. controller join works
5. hosted release finalize/publish works

Also add a cheap way to answer:

1. what platform build is live
2. what server build is live
3. what browser worker build is live

Production identity should be queryable, not guessed from symptoms.

## Immediate Next Steps

The next practical hardening steps are:

1. audit the exact release moderation/browser endpoint contract from code
2. choose the browser worker implementation shape
3. provision that worker as a dedicated deployable service
4. wire the platform env to it
5. re-test hosted release publish with a fresh release

## Non-Goals

This cleanup does not require:

1. moving the platform app off Vercel
2. moving the realtime server off Railway
3. collapsing all services into one runtime
4. coupling release moderation into the realtime server

Those moves would make the system less clear, not more.
