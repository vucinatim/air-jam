# Railway Deployment Guide

Last updated: 2026-05-08  
Status: active guide

Related docs:

1. [Deployment Topology](../strategy/deployment-topology.md)
2. [Production Observability Baseline](../strategy/production-observability-baseline.md)
3. [Post-v1 Topology Roadmap](../strategy/post-v1-topology-roadmap.md)

## Purpose

This guide explains the deploy model that now matters:

1. Railway hosts the platform, realtime server, and browser worker
2. Railway native PR environments own preview lifecycle
3. the repo only owns config clarity, inspection, and validation

Do not treat Air Jam deploys as a split Vercel plus Railway system anymore.

## Canonical Services

The production Railway project should contain three deployable services:

1. `air-jam-platform`
2. `air-jam-server`
3. `air-jam-release-browser-worker`

Persistent infrastructure remains external:

1. PostgreSQL on Railway
2. release/media object storage in R2

## Canonical Preview Model

Previews should be Railway-native.

That means:

1. PR environments are enabled at the project level
2. focused PR environments are disabled unless Railway proves they are reliable enough
3. each PR environment contains the same service set as production
4. the repo does not mint custom `full-pr-*` aliases or own preview teardown

## Repo Commands

The repo now exposes Railway inspection, not a custom preview control plane.

Use:

```bash
pnpm run repo -- railway whoami
pnpm run repo -- railway doctor
pnpm run repo -- railway doctor --json
```

`railway doctor` should answer:

1. which project we are inspecting
2. whether PR environments are enabled
3. which environment is primary
4. which ephemeral environments are currently open
5. whether platform, server, and worker all have healthy deploy identity

## Production Contract

Production should stay boring:

1. the platform serves `airjam.io`
2. the server serves `api.airjam.io`
3. the browser worker is not public product UI and should expose only the narrow routes it needs
4. the platform should consume the public server URL explicitly rather than guessing from provider-specific env

## Validation Checklist

Before treating a Railway deployment as good, verify:

1. platform `/` returns `200`
2. platform `/arcade` returns `200`
3. platform `/docs` returns `200`
4. platform `/api/health` returns `200`
5. platform `/api/auth/get-session` returns `200`
6. platform `/api/airjam/host-grant` works same-origin
7. server `/health` returns `200`
8. worker `/health` returns `200`

For PR environments, verify the same shape against the ephemeral Railway domains.

## What Not To Reintroduce

Do not rebuild the old split-provider preview system casually.

Avoid:

1. repo-owned preview up/down workflows
2. custom full-stack preview aliases
3. Vercel-specific fallback identity logic
4. provider-guessing bootstrap rules

If deploy complexity grows again, prefer making the Railway contract more explicit rather than adding a second orchestration layer.
