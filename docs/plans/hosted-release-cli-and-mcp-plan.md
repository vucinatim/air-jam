# Hosted Release CLI And MCP Plan

Last updated: 2026-04-25  
Status: Phase 3 CLI release flow landed

Related docs:

1. [Public Arcade Release Strategy](../strategy/public-arcade-release-strategy.md)
2. [Deployment and Monetization Strategy](../strategy/deployment-and-monetization-strategy.md)
3. [Air Jam MCP And Agent Devtools Plan](./air-jam-mcp-and-agent-devtools-plan.md)
4. [Work Ledger](../work-ledger.md)

## Purpose

Define the clean next step for Air Jam publishing:

1. keep the existing hosted release artifact model
2. make it usable from local CLI workflows
3. expose the same flow through MCP for agents
4. add the smallest correct auth model for non-browser publishing

This plan is about **hosted Arcade release publishing**, not npm package release publishing.

## Current State

The repo already has a real hosted-release foundation.

### What already exists

1. Local bundle creation exists in `create-airjam` as `airjam release bundle`.
2. The hosted artifact contract already exists:
   - fixed `index.html`
   - fixed `.airjam/release-manifest.json`
   - fixed `/` host route
   - fixed `/controller` controller route
3. The platform already has a release domain model:
   - `game_releases`
   - `game_release_artifacts`
   - `game_release_checks`
   - `game_release_reports`
4. The platform already has browser/dashboard upload flow:
   - create draft release
   - request presigned upload URL
   - upload archive to R2
   - finalize upload
   - validate archive
   - moderate
   - publish live
5. Public hosted release serving already exists from stored extracted assets.

### Where the current boundary was wrong or incomplete

1. Local release bundling lived in `packages/create-airjam/src/index.ts` instead of shared publish/release tooling.
2. Hosted artifact contract constants were duplicated between the CLI and the platform.
3. The platform release flow is browser/dashboard-only today.
4. There is no stable machine-facing platform release API for CLI or MCP.
5. There is no non-browser auth flow for local CLI or agents.
6. MCP can inspect, run, and validate games locally, but it cannot submit or publish a hosted release.

### Latest progress

1. the hosted release artifact contract now has one shared owner at `@air-jam/sdk/release`
2. platform release code now reuses that shared SDK leaf instead of carrying its own hosted artifact constants/schema copy
3. local hosted release operations now live in `@air-jam/devtools-core`
4. `create-airjam` is now a thin CLI adapter for `release doctor`, `release bundle`, and `release validate`
5. focused release-core tests now cover project inspection, invalid controller-path rejection, bundle creation, and archive validation
6. the platform now exposes a browser-assisted machine-auth lane under `/api/cli/auth/*`, backed by a dedicated device-grant table plus the existing Better Auth `sessions` table for issued machine tokens
7. `create-airjam` now exposes `airjam auth login`, `airjam auth whoami`, and `airjam auth logout` as thin adapters over shared `@air-jam/devtools-core` auth helpers, with one shared local session file for CLI and future MCP use
8. the platform now exposes bearer-authenticated machine release endpoints for owned games, release listing/detail, draft creation, upload-target issuance, finalize, and publish under `/api/cli/games/*` and `/api/cli/releases/*`
9. `@air-jam/devtools-core` now owns the remote hosted-release client flow too: list release targets, list releases for an owned game, inspect a release, submit a local bundle, and publish a ready release
10. `create-airjam` now exposes `airjam release list`, `airjam release inspect`, `airjam release submit`, and `airjam release publish` as thin adapters over that shared release client
11. focused tests now cover the remote release client sequence end to end, including draft creation, presigned upload handoff, finalize, and publish
12. hosted release runtime gating is now explicit at the SDK topology boundary, so browser log sinks and preview-controller workspace do not auto-boot inside hosted/self-hosted production builds
13. the platform moderation story is now intentionally fail-closed in docs as well as code: skipped moderation leaves the release failed instead of publishing with warnings
14. hosted release HTML bootstrap now publishes one explicit `hosted-release` runtime topology for the current surface, and both the SDK resolver and harness runtime consume that before any looser env/window inference; a fresh local published Pong release no longer emits `__airjam/dev/harness/*` or `__airjam/dev/browser-logs` traffic and connects its host socket directly to the configured backend origin

## Core Decision

Keep **release** as the canonical domain term.

Do not introduce a parallel `publish` object model.

The domain is:

1. build a hosted release bundle locally
2. validate the bundle
3. submit the bundle as a release artifact
4. inspect release state
5. publish a ready release live

So the CLI should evolve from:

1. `airjam release bundle`

to a fuller release namespace:

1. `airjam release doctor`
2. `airjam release bundle`
3. `airjam release validate`
4. `airjam release submit`
5. `airjam release list`
6. `airjam release inspect`
7. `airjam release publish`

`publish` stays an action on a release, not a separate subsystem name.

## Architecture

Follow the same rule as the MCP/devtools track:

```text
shared release core -> CLI -> MCP
```

### Target ownership

#### `@air-jam/devtools-core`

Owns shared release operations:

```text
src/release/
  hosted-artifact-contract.ts
  inspect-local-release.ts
  bundle-local-release.ts
  validate-local-release.ts
  release-client-config.ts
  auth-device-flow.ts
  platform-release-client.ts
  submit-release.ts
  list-releases.ts
  inspect-release.ts
  publish-release.ts
```

This becomes the single machine-facing owner for:

1. local hosted release bundle creation
2. local hosted release validation
3. auth/session storage for CLI and MCP
4. platform release submission and state inspection

#### `create-airjam`

Stays the human/project CLI adapter.

It should call shared release-core functions instead of owning bundling logic directly.

#### `@air-jam/mcp-server`

Stays a thin adapter over shared release-core functions.

Long-running upload/check flows should use MCP task-backed tools.

#### `apps/platform`

Owns server-side release state, validation, moderation, storage, and authorization.

It should expose a stable machine-facing API for release actions, but keep using the existing release domain services internally.

## Shared Contract Cleanup First

Before adding remote publish actions, do one small cleanup pass.

### Extract the hosted release artifact contract

Today the same contract shape exists in more than one place.

Move the canonical shared contract into one reusable module, likely under `@air-jam/sdk` or a small shared release contract module.

It should own:

1. hosted release manifest schema
2. manifest builder
3. host path
4. controller path
5. entry path
6. SPA fallback rules if those are part of the public contract

This removes duplication between:

1. `packages/create-airjam`
2. `apps/platform`
3. future `devtools-core` release logic

### Extract local bundling into shared release core

Current `airjam release bundle` logic should move out of `create-airjam/src/index.ts`.

The adapter CLI can stay there, but the real behavior should move into shared code.

That lets:

1. CLI use it
2. MCP use it
3. tests hit one owner
4. future Studio/agent flows reuse it without shelling into the CLI

## Local Release Flow

The local side should become explicit and machine-usable before any hosted mutation work.

### Release doctor

`airjam release doctor --dir .`

Checks:

1. `src/airjam.config.ts` exists
2. `gameMetadata` exists and is valid enough for hosted submission prefill
3. controller path matches hosted requirements
4. build script exists
5. `dist/` shape is valid if build is skipped
6. hosted artifact contract requirements are satisfiable

This should return structured output, not only human text.

### Release bundle

Keep `airjam release bundle --dir .`

Behavior:

1. optionally build
2. validate build output shape
3. inject hosted manifest
4. write `.airjam/release-manifest.json`
5. write zip artifact under `.airjam/releases/<version>/`

This is already real; just move ownership into shared release core.

### Release validate

Add `airjam release validate --dir .` and `--bundle <path>`.

This should run the same contract checks as the platform archive validator wherever practical:

1. bundle contains manifest
2. bundle contains entry path
3. file count and size limits
4. no path traversal
5. route contract matches hosted expectations

The point is not to fully replace server validation.

The point is:

1. fail early locally
2. let agents understand what is wrong before upload
3. keep local and hosted rules aligned

## Platform Machine API

Do not have the CLI or MCP call browser-only tRPC assumptions directly.

Expose a small dedicated machine-facing API.

### Why not reuse dashboard UI flow directly

The current dashboard release flow is good for the browser, but it is not the right long-term contract for:

1. local CLI
2. MCP tools
3. future Air Jam Studio agents

The platform should expose stable JSON endpoints or a small typed client boundary over the same release services.

### Recommended API shape

Suggested first-party endpoints:

```text
POST /api/cli/auth/device/start
POST /api/cli/auth/device/poll
POST /api/cli/auth/device/approve
POST /api/cli/auth/logout
GET  /api/cli/auth/me

GET  /api/cli/games
GET  /api/cli/games/:gameId/releases
GET  /api/cli/releases/:releaseId
POST /api/cli/releases
POST /api/cli/releases/:releaseId/upload-target
POST /api/cli/releases/:releaseId/finalize
POST /api/cli/releases/:releaseId/publish
POST /api/cli/releases/:releaseId/archive
```

These endpoints should call the existing release domain services rather than reimplementing logic.

## Auth Model

Do **not** start with generic OAuth-provider work.

For this project, the best first step is a first-party browser-assisted device login flow that reuses the existing platform account system.

### Why not full OAuth first

1. the platform already uses Better Auth and browser sessions
2. the first consumer is our own CLI and MCP, not arbitrary third-party apps
3. a generic OAuth provider adds protocol surface before the release workflow is even finalized

That is upside down.

### Recommended first auth cut

Build a first-party device/approval flow:

1. `airjam auth login`
2. CLI requests a device challenge from the platform
3. CLI prints the dashboard approval URL and code
4. logged-in user approves the CLI session from `/dashboard/cli-auth`
5. CLI polls until approved
6. platform returns a revocable machine session token
7. CLI stores that machine session locally

Local token storage:

1. use a dedicated Air Jam config file under XDG/Codex-appropriate config storage
2. store only the minimum needed
3. support `airjam auth logout` and `airjam auth whoami`

### Token model

The first implementation should stay minimal:

1. device approval state lives in a dedicated `machine_auth_device_grants` table
2. issued machine tokens reuse the existing Better Auth `sessions` table
3. CLI and MCP never reuse browser cookies directly
4. logout revokes the machine session token server-side and clears the local auth file

### Future OAuth position

If later we want:

1. third-party CI integrations
2. external deployment partners
3. marketplace-style integrations

then wrap the same release API behind a proper OAuth 2.1 provider or equivalent machine-auth layer.

But that is a later product step, not the right first implementation.

## CLI Surface

### Auth commands

```text
airjam auth login
airjam auth whoami
airjam auth logout
```

### Release commands

```text
airjam release doctor --dir .
airjam release bundle --dir .
airjam release validate --dir .
airjam release submit --dir . --game <slug-or-id>
airjam release list --game <slug-or-id>
airjam release inspect --release <id>
airjam release publish --release <id>
```

### `submit` behavior

`submit` should be the high-value automation path.

Default flow:

1. ensure auth
2. run local doctor/validate
3. build bundle if needed
4. resolve target game
5. create draft release
6. request upload target
7. upload zip
8. finalize upload
9. return structured result with release id and resulting state

Optional later flags:

1. `--publish-if-ready`
2. `--version-label`
3. `--bundle <path>`
4. `--skip-build`

## MCP Surface

Add release tools only after CLI and shared core exist.

Suggested tools:

1. `airjam.release_doctor`
2. `airjam.release_bundle`
3. `airjam.release_validate`
4. `airjam.release_submit`
5. `airjam.release_list`
6. `airjam.release_inspect`
7. `airjam.release_publish`
8. `airjam.auth_status`

Task-backed tools:

1. `airjam.release_bundle`
2. `airjam.release_submit`

Those can take long enough that they should not be plain blocking calls.

## Metadata And Game Resolution

The local game should not need duplicate publish metadata files.

Use the existing typed metadata lane first:

1. `gameMetadata`
2. `airjam.config.ts`

Near-term rule:

1. local release commands read `gameMetadata`
2. platform game records remain authoritative
3. CLI resolves the target dashboard game by explicit id/slug first
4. later we can add metadata prefill/diff using the existing `gameMetadata` export

Do not block the publish flow on full metadata sync redesign.

## Rollout Phases

### Phase 1. Shared release core cleanup

1. extract hosted artifact contract into one shared module
2. move local bundle logic from `create-airjam` into shared release core
3. add `release doctor`
4. add `release validate`

Acceptance:

1. existing `airjam release bundle` still works
2. local doctor/validate are machine-usable
3. duplicated hosted artifact contract constants are gone

Status: complete

### Phase 2. Platform machine API and auth

1. add first-party device login flow
2. add token storage/revocation model
3. add stable machine-facing release endpoints
4. keep dashboard UI on the same release services

Acceptance:

1. CLI can authenticate without browser cookie hacks
2. platform can service non-browser release actions safely

Status: complete

### Phase 3. CLI release submission

1. add `auth login/logout/whoami`
2. add `release submit/list/inspect/publish`
3. test against a real dashboard game and real R2 upload

Acceptance:

1. a local developer can create and publish a hosted release without using the dashboard upload UI manually

Status: complete

### Phase 4. MCP release tools

1. wrap shared release core in MCP tools
2. make long-running submit flows task-backed
3. verify agent-driven release submit and publish

Acceptance:

1. an agent can prepare, submit, inspect, and publish a hosted release through Air Jam-native tools

Status: pending

## Test Plan

### Shared core

1. local bundle contract tests
2. local validate tests
3. bundle path/version output tests
4. metadata/game resolution tests

### Platform API

1. device auth flow tests
2. token/logout tests
3. release API auth/ownership tests
4. upload/finalize/publish integration tests

### CLI

1. command help tests
2. submit against a local/mock platform
3. auth state storage tests

### MCP

1. tool registration tests
2. task-backed submit flow tests

## Recommended Work Order

1. extract hosted artifact contract
2. move local release bundle logic into shared release core
3. add local `release doctor` and `release validate`
4. add platform device auth and machine release API
5. add CLI `auth` and `release submit/publish`
6. add MCP release tools

## Bottom Line

The best path for Air Jam is:

1. keep the existing hosted release artifact model
2. keep `release` as the primary domain term
3. move local release logic into shared release core
4. add a dedicated machine-facing platform release API
5. use first-party browser-assisted device auth before generic OAuth
6. add MCP only after the shared core and CLI are real

That matches the codebase we already have and the long-term AI-native product direction without adding a second publishing model or premature auth complexity.
