# Environment Contracts

Last updated: 2026-08-30
Status: current contract

## Purpose

Air Jam runtime-owning boundaries now use explicit env contracts with shared validation and fail-fast startup behavior.

Goals:

1. validate env once per runtime boundary
2. stop scattered ad hoc `process.env` parsing
3. fail fast with clear, actionable terminal errors

## Architecture

### Shared Core

- package: `@air-jam/env`
- shared API:
  1. `validateEnv({ boundary, schema, env })`
  2. `EnvValidationError`
  3. `isEnvValidationError(error)`
  4. `formatEnvValidationError(error, options)`

### Boundary-Owned Schemas

Each boundary owns its own env schema and defaults:

1. `@air-jam/server` startup env contract
2. `apps/platform` releases env contract (storage, moderation, and the
   untrusted-content public origin)
3. `create-airjam` runtime env contract (`dev`, `secure:init`, `topology`)
4. `@air-jam/release-browser-worker` runtime env contract for the dedicated Playwright moderation worker

The platform's canonical creator-content boundary is
`AIRJAM_RELEASES_PUBLIC_ORIGIN`. It is intentionally server-owned rather than
public build-time configuration. Hosted release delivery remains disabled when
the value is missing or invalid, and production requires an `https` origin on a
separate cookie site from the authenticated platform. The origin must also stay
outside Better Auth trusted origins.

Operators and agents inspect the same runtime assessment without exposing
credentials:

```bash
pnpm run repo -- platform release-origin inspect
pnpm --silent run repo -- platform release-origin inspect --json
pnpm --silent run repo -- platform release-origin inspect --platform-url https://airjam.io --json
pnpm --silent run repo -- platform release-origin attest --platform-url https://airjam.io --release-url https://<release-domain>/releases/g/<game-id>/r/<release-id>/ --railway-project <project-id> --json
```

The optional `--platform-url` mode verifies the boundary exposed by a deployed
platform's public `/api/health` contract. It does not load or print provider
credentials.

Both healthy `200` and valid unhealthy `503` platform health documents are
inspection results. The remote JSON includes the HTTP status, platform health
boolean, and boundary assessment; non-health responses fail instead of being
mistaken for deployed configuration.

The health contract also exposes non-secret, deployment-reported identity:
`provider`, `environment`, `deploymentId`, and `revision`. The attestation
command reads health before and after its bounded checks and requires that
identity to remain stable. Missing identity does not turn a local diagnostic
into a failure, but it makes `productionEvidenceEligible` impossible. The
revision is not independently authenticated by the provider query.

Production eligibility additionally requires an expected Railway project from
`--railway-project <project-id>` or `RAILWAY_PROJECT_ID`, plus one supported
provider credential: `RAILWAY_PROJECT_TOKEN`, `RAILWAY_API_TOKEN`, or
`RAILWAY_TOKEN`. Railway verification is time-bounded and independently binds
the project, production environment, current platform-service deployment, and
both platform and release domains. Missing project or provider authority leaves
an otherwise passing transport attestation diagnostic.

Attestation URLs must be credential-free and query-free. The release URL must
be the exact `/releases/g/{gameId}/r/{releaseId}/` host root. This prevents
signed URLs or tokens from entering durable JSON evidence and prevents an
arbitrary descendant asset from standing in for the playable release.
Attestation independently applies the same conservative cookie-site policy as
configuration and probes the actual Better Auth anonymous-session surface, so
a stale or dishonest `ready` health claim cannot certify a sibling platform
subdomain or substitute for deployed browser-session isolation.

No monorepo-wide mega schema is used.

For `@air-jam/server`, the env contract now also owns the local DB safety rule:

1. non-production runtime accepts local `DATABASE_URL` values normally
2. non-local `DATABASE_URL` values are ignored by default outside production
3. intentional remote DB usage in local or test server flows requires `AIR_JAM_ALLOW_REMOTE_DATABASE=enabled`
4. imported server runtime/tests now load only repo-root and server-owned env files by default

## Error Contract

When env is invalid, startup/runtime command fails with a deterministic terminal report:

1. boundary name and "invalid environment configuration"
2. numbered issues by env key
3. expected rule
4. received value or `<missing>`
5. fix hint
6. docs hint footer

Colorized output is enabled on TTY and disabled in non-TTY/`NO_COLOR` contexts.

## Phase-2 Follow-ups

Phase 1 intentionally scoped to runtime-owning boundaries.

Follow-up candidates:

1. migrate `scripts/workspace/*` env parsing to `@air-jam/env`
2. migrate selected `scripts/repo/*` env parsing to `@air-jam/env`
