# Environment Contracts

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
2. `apps/platform` releases env contract (storage/moderation/public base URL)
3. `create-airjam` runtime env contract (`dev`, `secure:init`, `topology`)

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
