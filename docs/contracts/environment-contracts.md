# Environment Contracts

Last updated: 2026-10-09
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
2. installed creator runtime contracts (`dev`, `secure:init`, `topology`)
3. private product-owned schemas for platform, storage and hosted composition

The public standalone server does not own a product database or provider
credentials. Hosted authentication, release isolation, Browser Run tokens,
Railway attestations and remote-database safety rules belong to the private
product's schemas and operator commands. Missing hosted configuration must
fail explicitly rather than fall back to permissive standalone behavior.

Keep schemas boundary-owned; do not introduce a monorepo-wide mega schema.

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
