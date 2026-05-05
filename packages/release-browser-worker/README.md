# Release Browser Worker

Dedicated Playwright protocol worker for Air Jam hosted release screenshot capture and moderation.

## Purpose

This package exists so release screenshot capture and image moderation do not live inside:

1. the Vercel platform runtime
2. the realtime Railway server

The platform connects to this worker through a Playwright websocket endpoint and uses it during hosted release finalize/publish.

## Runtime Contract

The worker starts a long-lived Chromium server using the Playwright protocol.

The platform should point:

1. `AIRJAM_RELEASES_BROWSER_WS_ENDPOINT`

at the public websocket endpoint for this service.

## Railway Setup

Create a dedicated Railway service for this package.

Recommended setup:

1. source repo: `vucinatim/air-jam`
2. branch: `main`
3. root directory: repo root
4. config-as-code path: `/packages/release-browser-worker/railway.json`
5. builder: Dockerfile
6. Dockerfile path: `packages/release-browser-worker/Dockerfile`

The Docker image already:

1. uses the official Playwright base image
2. installs workspace dependencies
3. builds only `@air-jam/release-browser-worker`
4. starts the worker on port `8080`

The worker also exposes:

1. `GET /health` for Railway healthchecks
2. websocket proxying on the same public port for the Playwright endpoint

## Environment Variables

Optional env:

1. `AIRJAM_BROWSER_WORKER_HOST`
2. `AIRJAM_BROWSER_WORKER_PORT`
3. `AIRJAM_BROWSER_WORKER_HEADLESS`
4. `AIRJAM_BROWSER_WORKER_CHROMIUM_SANDBOX`
5. `AIRJAM_BROWSER_WORKER_EXECUTABLE_PATH`

In Railway, `PORT` is normally injected automatically and should be preferred.

## Vercel Wiring

Once the service is live, set:

1. `AIRJAM_RELEASES_BROWSER_WS_ENDPOINT`

on the platform deployment to the worker's public websocket endpoint.

Example shape:

```text
wss://<railway-public-domain>
```

## Local Development

Build:

```bash
pnpm --filter @air-jam/release-browser-worker build
```

Run:

```bash
pnpm --filter @air-jam/release-browser-worker dev
```
