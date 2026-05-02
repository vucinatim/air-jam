# Postgres Dev And Analytics Test DB Plan

Last updated: 2026-04-04  
Status: completed prerelease baseline

Related docs:

1. [V1 Release Launch Plan](./v1-release-launch-plan.md)
2. [Work Ledger](../work-ledger.md)
3. [Monorepo Operating System](../monorepo-operating-system.md)
4. [Analytics Architecture](../systems/analytics-architecture.md)

## Purpose

Give Air Jam one clean Postgres story for both local development and destructive analytics testing without mixing the two lifecycles.

This plan exists because the repo currently has a real gap:

1. destructive runtime analytics tests still depend on the shared runtime DB wiring
2. local development does not yet have a repo-owned Postgres setup with clear reset semantics

The goal is to make both stories explicit and safe:

1. one persistent local dev Postgres
2. one disposable analytics test Postgres

## Core Position

These are related, but they are not the same thing.

Air Jam should treat them as two intentionally different database modes:

1. **local dev DB**
   1. persistent
   2. human-managed
   3. visible on disk
   4. safe to inspect and manually reset
2. **analytics test DB**
   1. disposable
   2. tool-managed
   3. safe to destroy automatically
   4. never shared with normal development data

Do not solve both with one ambiguous `DATABASE_URL` story.

## Current Release-Phase Default

Before public release, keep the current maintainer posture explicit:

1. normal local platform/server work may continue to point at the current production database when that is the intentional release-readiness workflow
2. the repo-owned local dev Postgres should be added now as an available local option, not forced as the immediate prerelease default
3. destructive analytics tests must still be isolated immediately and may never run against the production-connected or shared development `DATABASE_URL`

After release, the intended default should flip:

1. normal development uses the repo-owned local dev Postgres by default
2. production DB access remains an explicit maintainer workflow, not the everyday default

## Desired End State

Air Jam should support these two workflows cleanly:

1. a maintainer can run a repo-owned local Postgres for platform/server development and wipe it by deleting local repo state
2. destructive analytics tests always run against an isolated Postgres instance and never touch the normal dev DB

The default repo-local data path should live under:

1. `.airjam/postgres/dev/`

That keeps the state visible and easy to delete without polluting the source tree.

## Implementation Direction

### 1. Persistent local dev Postgres

Add one repo-owned Docker compose setup at the root for development:

1. root `docker-compose.dev.yml`
2. `postgres:17-alpine`
3. bind mount `.airjam/postgres/dev/` into `/var/lib/postgresql/data`
4. stable local port and stable dev `DATABASE_URL`

Ownership:

1. repo-maintainer and local dev workflow only
2. managed through the repo CLI, not through scattered package scripts
3. available during prerelease without forcing an immediate switch away from the current production-connected workflow

Canonical repo CLI surface:

1. `pnpm run repo -- db up`
2. `pnpm run repo -- db down`
3. `pnpm run repo -- db wait`
4. `pnpm run repo -- db reset`
5. `pnpm run repo -- db url`

`db reset` should:

1. stop the container
2. remove `.airjam/postgres/dev/`
3. recreate the directory on next startup

### 2. Disposable analytics test Postgres

Destructive analytics integration tests should use a separate test helper with this contract:

1. default: start a disposable Docker Postgres container for the test run
2. override: allow `AIR_JAM_ANALYTICS_TEST_DATABASE_URL`
3. never fall back to the normal repo `DATABASE_URL`

Rules:

1. analytics tests create their own Drizzle client
2. analytics tests do not import the shared runtime DB singleton for destructive paths
3. missing Docker or failed container startup must produce a clear actionable test failure/skip message

### 3. Runtime and docs boundaries

Keep the boundaries explicit:

1. `DATABASE_URL` remains the normal app/server database contract
2. prerelease may continue using the production-connected `DATABASE_URL` intentionally for release-state validation
3. once the release flips to normal development posture, the local dev Postgres should become the default source for that same `DATABASE_URL` workflow
4. `AIR_JAM_ANALYTICS_TEST_DATABASE_URL` is only for destructive analytics tests
5. local dev Postgres docs live in the monorepo operating docs and release-prep docs only where relevant
6. analytics test isolation docs live with the analytics/testing guidance

Do not add a second generic DB abstraction layer.

## Done When

1. the repo can boot a persistent local Postgres with one repo CLI command
2. local dev DB state lives under `.airjam/postgres/dev/`
3. destructive analytics tests use a dedicated isolated Postgres path
4. destructive analytics tests cannot accidentally run against the shared dev/runtime DB
5. the local dev DB workflow and analytics test DB workflow are both documented clearly
