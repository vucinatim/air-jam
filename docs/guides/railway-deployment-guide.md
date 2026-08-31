# Railway Deployment Guide

Last updated: 2026-08-30
Status: active guide

Related docs:

1. [Deployment Topology](../strategy/deployment-topology.md)
2. [Production Observability Baseline](../strategy/production-observability-baseline.md)
3. [Post-v1 Topology Roadmap](../strategy/post-v1-topology-roadmap.md)

## Purpose

This guide explains the deploy model that now matters:

1. Railway hosts the platform, realtime server, browser worker, and operational-job
   worker
2. Railway native PR environments own preview lifecycle
3. the repo only owns config clarity, inspection, and validation

Do not treat Air Jam deploys as a split Vercel plus Railway system anymore.

## Canonical Services

The production Railway project should contain four deployable services:

1. `air-jam-platform`
2. `air-jam-server`
3. `air-jam-release-browser-worker`
4. `air-jam-platform-worker`

Persistent infrastructure remains external:

1. PostgreSQL on Railway
2. release/media object storage in R2
3. a dedicated cookieless domain for untrusted hosted release content

## Canonical Preview Model

Previews are Railway-native.

That means:

1. PR environments are enabled at the project level
2. focused PR environments are disabled unless Railway proves they are reliable enough
3. each PR environment contains the same service set as production, including its own ephemeral Postgres
4. the repo does not mint custom `full-pr-*` aliases or own preview teardown

### Behavior on PR open

1. Railway clones every service into an ephemeral environment named `air-jam-pr-<number>`.
2. The ephemeral Postgres boots empty. The platform container applies the
   committed Drizzle migrations before starting Next.js, but only when
   `RAILWAY_ENVIRONMENT_NAME != "production"`.
3. Both the platform and realtime server must define `DATABASE_URL` as the
   Railway service reference `${{Postgres.DATABASE_URL}}`. Never store it as a
   literal: a PR environment generates new Postgres credentials, and a copied
   production connection string will fail authentication.
4. `resolvePlatformDeploymentConfig` detects `RAILWAY_ENVIRONMENT_NAME != "production"` and forces `githubAuthEnabled = false`. Avoids the GitHub OAuth wildcard-callback problem and keeps preview auth simple.
5. `.github/workflows/preview-comment.yml` polls Railway, resolves the platform service domain in the new environment, and posts a sticky preview-URL comment on the PR.

The workflow needs a single repo secret: `RAILWAY_PROJECT_TOKEN` (a Railway project-scoped token).

### Production schema management

Production schema is migration-managed (Drizzle Kit). The
`drizzle.__drizzle_migrations` tracking table is the source of truth for what
has been applied. New migrations land via `drizzle-kit migrate` run manually
against `DATABASE_PUBLIC_URL` from a maintainer's machine, never via the
production deploy pipeline. The preview-only container migration path does not
run when `RAILWAY_ENVIRONMENT_NAME=production`.

## Repo Commands

The repo now exposes Railway inspection, not a custom preview control plane.

Use:

```bash
pnpm run repo -- railway whoami
pnpm run repo -- railway doctor
pnpm run repo -- railway doctor --json
pnpm run repo -- platform release-origin inspect
pnpm --silent run repo -- platform release-origin inspect --json
pnpm --silent run repo -- platform release-origin inspect --platform-url https://airjam.io --json
pnpm --silent run repo -- platform release-origin attest --platform-url https://airjam.io --release-url https://<release-domain>/releases/g/<game-id>/r/<release-id>/generations/<generation-id>/ --railway-project <project-id> --json
```

`railway doctor` should answer:

1. which project we are inspecting
2. whether PR environments are enabled
3. which environment is primary
4. which ephemeral environments are currently open
5. whether platform, server, browser worker, and operational-job worker all have
   healthy deploy identity

`platform release-origin inspect` assesses local configuration by default.
Pass the deployed platform origin through `--platform-url` to inspect its public
`/api/readiness` contract authoritatively without loading or printing provider
credentials. Production must report `ready` before hosted release delivery is
considered healthy.

The inspector returns a valid Railway platform readiness document even when its
HTTP status is `503`, preserving `readiness.ok: false`, the effective platform
request-host policy, and the exact disabled or invalid boundary reason for
agents. It rejects an inspected URL that is not the deployment's reported
canonical platform origin. A valid unready response is diagnostic evidence, not
a healthy deployment: the validation checklist still requires production to
reach `200` with the expected origin, non-preview host policy, exact deployment
identity, and a `ready` release boundary. Railway's deployment healthcheck
remains `/api/health`, which reports process liveness independently of product
and release-domain readiness.

After the dedicated domain is routed, use `platform release-origin attest`
against one exact live release-generation root. The command is safe for unattended agents:
it performs bounded DNS-pinned HTTP/TLS checks and does not launch a browser or
execute release code. It independently rejects a shared cookie site and probes
the actual Better Auth anonymous-session response in addition to protected API
CORS. Preserve its JSON alongside the exact deployment being approved.
`productionEvidenceEligible: true` requires public HTTPS, a complete
and stable deployment-reported identity, every routing, response, cookie, and
protected-endpoint CORS check to pass, and a bounded Railway query that matches
the exact expected project, production environment, current platform-service
deployment, and both public domains. Supply `--railway-project <project-id>` or
`RAILWAY_PROJECT_ID` and one of `RAILWAY_PROJECT_TOKEN`, `RAILWAY_API_TOKEN`, or
`RAILWAY_TOKEN`. Without either identity or provider authority, passing
transport evidence remains diagnostic. The provider does not independently
authenticate the readiness revision. This is one input to Gate 5 closure, not a
substitute for the controlled hostile-browser and normal-game proofs.

## Production Contract

Production should stay boring:

1. the platform serves `airjam.io`
2. the server serves `api.airjam.io`
3. `AIRJAM_RELEASES_PUBLIC_ORIGIN` points at a dedicated cookieless site that is
   not `airjam.io` or any `*.airjam.io` sibling
4. the browser worker is not public product UI and should expose only the narrow routes it needs
5. the operational-job worker exposes only liveness, readiness, and authenticated
   drain; it owns durable processing, not public API traffic
6. the platform should consume the public server URL explicitly rather than guessing from provider-specific env

## Validation Checklist

Before treating a Railway deployment as good, verify:

1. platform `/` returns `200`
2. platform `/arcade` returns `200`
3. platform `/docs` returns `200`
4. platform `/api/health` returns `200` as process-liveness proof only
5. platform `/api/readiness` returns `200` with `ok: true`, the expected
   canonical platform origin, `isRailwayPreviewEnvironment: false`, and
   deployment identity matching the exact revision under approval
6. platform `/api/auth/get-session` returns `200`
7. platform `/api/airjam/host-grant` works same-origin
8. server `/health` returns `200`
9. browser worker `/health` returns `200`
10. operational-job worker `/health` returns `200`
11. operational-job worker `/ready` returns `200` only after PostgreSQL authority is
    available
12. release-origin attestation returns `status: passed`,
    `evidenceKind: production-deployment`, and
    `productionEvidenceEligible: true`

Before terminating or replacing the operational-job worker, call its authenticated
`POST /drain` endpoint and wait for bounded completion. Queue state remains in
PostgreSQL across deploys; a process restart must never be treated as job loss.

For PR environments, verify the same shape against the ephemeral Railway domains.

## What Not To Reintroduce

Do not rebuild the old split-provider preview system casually.

Avoid:

1. repo-owned preview up/down workflows
2. custom full-stack preview aliases
3. Vercel-specific fallback identity logic
4. provider-guessing bootstrap rules

If deploy complexity grows again, prefer making the Railway contract more explicit rather than adding a second orchestration layer.
