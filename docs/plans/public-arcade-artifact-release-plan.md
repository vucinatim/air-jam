# Public Arcade Artifact Release Plan

Last updated: 2026-03-30  
Status: active

Related docs:

1. [Public Arcade Release Strategy](../strategy/public-arcade-release-strategy.md)
2. [Deployment and Monetization Strategy](../strategy/deployment-and-monetization-strategy.md)
3. [Framework Paradigm](../framework-paradigm.md)
4. [Auth Capability Plan](./auth-capability-plan.md)

## Goal

Build a professional public Arcade release system based on immutable uploaded artifacts while preserving self-hosted Air Jam as a first-class path.

The intended outcome is:

1. self-hosted URL mode remains available for creators outside the public Arcade lane
2. public Arcade launches only Air Jam-controlled immutable releases
3. release state becomes the control point for moderation, rollback, and future deploy UX
4. public game media should also move away from arbitrary external URLs toward Air Jam-managed media assets

## Non-Goals

This plan does not aim to build:

1. a general-purpose Vercel competitor
2. arbitrary cloud build infrastructure as the first step
3. server-side rendering support
4. custom domains in the first slice
5. full Git-connected deploy automation in the first slice

## Professional Target Shape

The first professional version should have these product objects:

1. `game`
2. `release`
3. `release artifact`
4. `game media asset`
5. `release status`
6. `live hosted URL`

The first professional publish flow should be:

1. creator uploads a static build artifact
2. platform validates and stores it immutably
3. platform creates a release record
4. automated checks run
5. release becomes `live` only after those checks pass
6. public Arcade launches the Air Jam-hosted release URL

## Current Repo Baseline

Today the platform is still centered around a mutable game URL model.

Current core surfaces:

1. game metadata and URL live in `apps/platform/src/db/schema.ts`
2. game CRUD and public lookup live in `apps/platform/src/server/api/routers/game.ts`
3. dashboard game settings still treat URL as the primary hosted source
4. public Arcade and preview resolve game launch from the stored `game.url`
5. platform game iframe rendering lives in `apps/platform/src/components/arcade/game-player.tsx`
6. public and preview routes currently flow through `apps/platform/src/app/arcade/[[...slug]]/page.tsx` and `apps/platform/src/app/play/[slugOrId]/page.tsx`
7. public catalog media is still stored as raw `thumbnailUrl`, `videoUrl`, and `coverUrl` fields on `games`

This means the first implementation step is not to replace everything at once.

The first step is to introduce the release model beside the current game model, then cut public Arcade over deliberately.

## Implemented Baseline

The first backend foundation now exists in the repo.

Implemented so far:

1. canonical release tables exist for releases, artifacts, and checks
2. `releaseRouter` exists with draft, publish, archive, quarantine, upload-target, and finalize-upload actions
3. release state transitions are now expressed through a shared release policy module
4. a provider-neutral release storage boundary now exists with a first Cloudflare R2 implementation
5. uploaded zip artifacts can now be validated, extracted, and materialized into immutable release asset paths
6. structural archive validation now writes `artifact_validation` check records and blocks `ready` until it passes
7. the dashboard now has an initial `Releases` surface for upload, publish, archive, quarantine, and release inspection
8. game overview and dashboard navigation now expose the hosted-release lane explicitly beside the optional creator preview URL
9. hosted release assets now have a canonical served route and public Arcade/public play resolve from live hosted releases instead of `game.url`
10. publishing and manual moderation reruns now capture a canonical hosted-release screenshot and run image moderation before a release can stay in the live lane
11. public abuse reports now attach directly to hosted releases and are visible from the release dashboard
12. the dashboard IA has now been split into `Overview`, `Arcade Releases`, `Media`, `Security`, and `Analytics`
13. the old game-level `isPublished` field has now been replaced by `arcadeVisibility: hidden | listed`
14. the old `/settings` and `/self-hosted` surfaces now redirect back into Overview, where profile fields and the optional preview URL live beside distribution state
15. overview now centralizes profile editing, preview URL editing, and distribution state with release actions using `Make Live` wording
16. a game can now only be listed in Arcade if it has a live hosted release, and removing the live release automatically drops Arcade visibility back to `hidden`
17. game media is now backed by `game_media_assets`, active media slots on `games`, a dedicated `gameMediaRouter`, and stable `/media/g/{gameId}/{kind}` serving routes
18. the dashboard now has a dedicated `Media` page, and public catalog surfaces now resolve managed media URLs instead of raw creator-provided asset URLs
19. the old raw `thumbnail_url`, `cover_url`, and `video_url` columns have now been removed from `games`

Current missing slices:

1. an explicit admin or ops review surface for reports beyond the creator-facing release dashboard
2. asynchronous moderation execution if publish volume or provider latency makes synchronous publish checks too expensive
3. optional richer heuristics beyond screenshot moderation, such as URL reputation or additional release policy checks
4. run one end-to-end dashboard smoke pass for upload, make-live, and listed-in-Arcade against the new contract
5. run one end-to-end dashboard smoke pass for managed media upload, assignment, and public catalog rendering

Current v1 storage env surface:

1. `AIRJAM_RELEASES_R2_BUCKET`
2. `AIRJAM_RELEASES_R2_ACCOUNT_ID` or `AIRJAM_RELEASES_R2_ENDPOINT`
3. `AIRJAM_RELEASES_R2_ACCESS_KEY_ID`
4. `AIRJAM_RELEASES_R2_SECRET_ACCESS_KEY`
5. optional `AIRJAM_RELEASES_UPLOAD_URL_TTL_SECONDS`
6. optional `NEXT_PUBLIC_RELEASES_BASE_URL` or `AIRJAM_RELEASES_BASE_URL` for a dedicated public release origin

Current moderation env surface:

1. `AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN`
2. `AIRJAM_RELEASES_BROWSER_WS_ENDPOINT` or `AIRJAM_RELEASES_BROWSER_EXECUTABLE_PATH`
3. optional `AIRJAM_RELEASES_BROWSER_NAVIGATION_TIMEOUT_MS`
4. optional `AIRJAM_RELEASES_BROWSER_WAIT_AFTER_LOAD_MS`
5. optional `AIRJAM_RELEASES_BROWSER_VIEWPORT_WIDTH`
6. optional `AIRJAM_RELEASES_BROWSER_VIEWPORT_HEIGHT`
7. `OPENAI_API_KEY`
8. optional `AIRJAM_RELEASES_OPENAI_MODERATION_MODEL`
9. optional `AIRJAM_RELEASES_OPENAI_BASE_URL`
10. optional `AIRJAM_RELEASES_OPENAI_TIMEOUT_MS`

Operational note:

1. browser uploads to R2 require the bucket CORS policy to allow the platform origin for signed `PUT` uploads
2. if a dedicated release origin is used, it should route the canonical `/releases/g/{gameId}/r/{releaseId}/...` path shape to the same release asset handler or equivalent edge layer
3. screenshot moderation requires a reachable browser runtime plus an internal inspection token so non-live hosted releases can be rendered privately during checks
4. screenshot moderation is now optional at runtime; if browser or moderation env is missing, publish records a warning check and continues through the hosted release flow

## Implementation Rules

These rules should constrain every phase:

1. do not break self-hosted URL mode while building the hosted release path
2. do not make runtime/framework users depend on artifact hosting unless they choose public Arcade distribution
3. keep the first hosted path static-only
4. keep storage provider details behind a small adapter boundary
5. keep release state authoritative instead of encoding policy in ad hoc booleans
6. avoid building Git-connected deploys, build runners, or custom-domain work in the first slice
7. do not overload one word like "publish" across release promotion and public catalog visibility
8. prefer explicit lane names over vague configuration buckets

## Product Language Reset

The next dashboard pass should reset the creator-facing language around three separate concepts:

1. `preview URL`
2. `live Arcade release`
3. `Arcade visibility`

The old model blurred these into one loose idea of "published game".

That no longer matches the product.

### New Canonical Terms

Use these terms consistently in schema, router APIs, UI copy, and docs:

1. `Preview URL`
   An optional creator-only URL for localhost, staging, or an external deployment when Air Jam needs to iframe the game privately for preview.
2. `Arcade Release`
   An immutable Air Jam-hosted artifact upload managed by release state.
3. `Make Live`
   Promote one Arcade release to be the active hosted build for this game.
4. `Arcade Visibility`
   Whether the game appears in the public Arcade catalog.

### Terms To Remove Or Phase Out

These should be deprecated because they no longer describe the system honestly:

1. game-level `Published` as the primary public-state label
2. vague dashboard `Configuration` naming
3. generic release button text `Publish` when the action is really "make this release live"

## Dashboard IA Reset

The intended dashboard information architecture should become:

1. `Overview`
2. `Arcade Releases`
3. `Media`
4. `Security`
5. `Analytics`

This IA should map directly to product responsibilities:

### Overview

This becomes the single high-level distribution control surface.

It should contain:

1. one compact progress or stepper component:
   1. `Upload Release`
   2. `Make Live`
   3. `List In Arcade`
2. one strong `Distribution` card with:
   1. `Preview URL`
   2. `Live Arcade release`
   3. `Arcade visibility`
3. game profile editing
4. one obvious CTA for the next incomplete Arcade step

### Arcade Releases

This is the immutable hosted distribution lane.

It should contain:

1. upload build zip
2. validate artifact
3. inspect checks
4. make one release live
5. review reports and moderation state
6. rollback or archive

### Media

This should become the game-presentation lane for catalog visuals.

It should contain:

1. thumbnail image upload
2. cover image upload
3. preview video upload
4. validation state and preview
5. the current active asset for each media slot
6. explicit copy that this media powers public catalog and landing surfaces, not self-hosted runtime bootstrap

### Security

This should contain:

1. App ID
2. allowed origins policy
3. regeneration and policy controls

This prevents security settings from living inside a generic page with unrelated distribution fields.

### Analytics

This remains analytics-focused and should not carry distribution primitives.

## Data Model Reset

The dashboard rename should not stay cosmetic.

The old game-level `isPublished` field should be replaced with a more honest visibility field:

1. `arcadeVisibility: hidden | listed`

This is a semantic upgrade, not just a UI rename.

Why this should happen now:

1. `isPublished` still implies a single publish concept that no longer exists
2. the system now has both release promotion and public catalog listing
3. keeping the old boolean will keep leaking confusion into code, copy, filters, and APIs

Recommended transition:

1. add `arcade_visibility`
2. backfill `is_published=true` to `listed` and `false` to `hidden`
3. move all reads and writes to the new field
4. remove `is_published` instead of keeping both long-term

Recommended enum values:

1. `hidden`
2. `listed`

Do not over-configure the first version with `unlisted`, `scheduled`, or additional states until the product truly needs them.

## Distribution State Model

Creator-facing distribution should be understood as the combination of:

1. self-hosted URL presence
2. live hosted release presence
3. Arcade visibility
4. active managed media assets

That means a game can be:

1. self-hosted only
2. hosted-release capable but not live
3. live in Air Jam hosting but hidden from public Arcade
4. live and listed in public Arcade

This is why one boolean or one "publish" word is no longer sufficient.

## UX Contract Changes Required

The next implementation slice should make these UI changes explicitly:

1. rename `Configuration` page to `Self-Hosted`
2. add `Security` as the dedicated App ID and origin-policy page
3. rename release action `Publish` to `Make Live`
4. rename game-level public toggle from `Published` to `Listed in Arcade`
5. centralize distribution status on `Overview`
6. show next-step guidance through status-first UI instead of explanatory paragraphs
7. move thumbnail, cover, and preview video management off `Self-Hosted` and onto a dedicated `Media` page
8. stop asking creators for raw media URLs once the managed media slice lands

## Game Media System Reset

The build-release fix should be extended to catalog media so the public product stops trusting arbitrary third-party asset URLs.

Today the platform still treats:

1. `thumbnailUrl`
2. `coverUrl`
3. `videoUrl`

as mutable external URL strings stored directly on `games`.

That is the same class of trust problem we just removed from public game launches.

### Product Decision

Game media should become a first-class managed subsystem.

The professional target is:

1. Air Jam stores game media assets in controlled object storage
2. the platform serves stable Air Jam media URLs to public surfaces
3. games reference managed media assets, not arbitrary external URLs
4. the old raw URL fields are fully removed after migration

### What `/public` Should And Should Not Be Used For

`/public` is still fine for:

1. platform-owned static assets
2. repo-local development helpers
3. non-user-owned marketing assets

`/public` should not become the durable storage layer for creator game media.

Public game thumbnails, covers, and preview videos should live in managed object storage, not in repo files or third-party URLs.

### Storage Decision For Media

The first media slice should use the same Cloudflare R2 bucket as hosted releases.

Do not add a second bucket unless lifecycle or access requirements genuinely diverge later.

Use separate key prefixes instead:

1. `games/{gameId}/releases/{releaseId}/...`
2. `games/{gameId}/media/thumbnail/{assetId}/...`
3. `games/{gameId}/media/cover/{assetId}/...`
4. `games/{gameId}/media/preview-video/{assetId}/...`

This keeps ops simple while preserving clean subsystem boundaries in code.

### Data Model For Media

The proper first version should add explicit media records instead of overloading `games`.

Recommended schema shape:

1. `game_media_assets`
2. `game_media_kind = thumbnail | cover | preview_video`
3. `game_media_status = draft | ready | failed | archived`
4. `games.thumbnail_media_asset_id`
5. `games.cover_media_asset_id`
6. `games.preview_video_media_asset_id`

Each media asset record should carry:

1. `id`
2. `game_id`
3. `kind`
4. `status`
5. `storage_key`
6. `original_filename`
7. `mime_type`
8. `size_bytes`
9. `checksum`
10. optional width and height
11. optional duration for video
12. created and updated timestamps

This keeps game-level assignment simple while preserving asset history.

### Media Upload And Serving Contract

The first media implementation should mirror the release upload discipline:

1. request signed upload target
2. upload blob directly to R2
3. finalize and validate asset
4. assign the asset to the game media slot
5. serve the asset from an Air Jam-controlled URL

Recommended public serving shape:

1. `/media/g/{gameId}/thumbnail`
2. `/media/g/{gameId}/cover`
3. `/media/g/{gameId}/preview-video`

These routes can resolve the currently assigned asset and either redirect or stream from R2.

This avoids leaking raw storage keys into public UI.

### Validation And Policy

Media validation should stay simple and deterministic in v1.

Required:

1. allow only image types for thumbnail and cover
2. allow only video types for preview video
3. size limits by slot
4. reject invalid mime and extension combinations
5. reject oversized or empty files

Optional later:

1. image dimension checks
2. video duration checks
3. moderation checks for media itself
4. generated poster frames for preview video

### Dashboard IA For Media

The intended dashboard IA should become:

1. `Overview`
2. `Arcade Releases`
3. `Media`
4. `Self-Hosted`
5. `Security`
6. `Analytics`

The `Media` page should own all catalog visuals.

The `Self-Hosted` page should go back to what it really is:

1. self-hosted launch URL
2. self-hosted metadata that truly belongs to that lane

It should no longer be the place where public catalog media is managed.

### Migration Rule

This should be a real replacement, not a compatibility forever-layer.

The correct sequence is:

1. add managed media schema and upload flow
2. add the `Media` dashboard page
3. migrate existing game media URLs into managed assets where possible
4. switch public surfaces to resolve managed media URLs
5. remove raw `thumbnailUrl`, `coverUrl`, and `videoUrl` fields from `games`

If some legacy rows cannot be migrated automatically, they should be flagged for manual re-upload rather than keeping the old URL model indefinitely.

### Concrete Execution Sequence For Managed Media

This should be implemented as one bounded slice in this order:

1. add `game_media_assets` plus slot references on `games`
2. add a small `gameMediaRouter` with:
   1. `listByGame`
   2. `requestUploadTarget`
   3. `finalizeUpload`
   4. `assignAsset`
   5. `archiveAsset`
3. extend the storage boundary with a media-specific adapter path on the same R2 bucket
4. add `/media/g/{gameId}/thumbnail`, `/cover`, and `/preview-video` serving routes
5. add the dashboard `Media` page and move media controls off `Self-Hosted`
6. switch public catalog surfaces to render managed media URLs
7. run a migration pass for existing media URLs
8. remove `thumbnailUrl`, `coverUrl`, and `videoUrl` from `games`

### V1 Limits For Managed Media

The first version should keep media policy intentionally small:

1. thumbnail:
   1. image only
   2. max 5 MB
2. cover:
   1. image only
   2. max 10 MB
3. preview video:
   1. video only
   2. max 50 MB
   3. max duration target should be enforced later if metadata extraction is not ready in the first pass

These exact limits can be tuned, but the important point is that they should be explicit and enforced server-side.

## Concrete Refactor Sequence For This Reset

This work should be done as one bounded system pass rather than piecemeal copy edits.

### Step A. Rename The Game Visibility Contract

1. replace `games.is_published` with `games.arcade_visibility`
2. update router inputs and outputs
3. update public filters and route checks
4. update seeded or existing data through a one-time migration

### Step B. Split Dashboard IA By Responsibility

1. `settings` route becomes `self-hosted`
2. add `security` route
3. update sidebar, breadcrumbs, and overview links
4. preserve redirects from the old route during the transition

### Step C. Rebuild Overview Around Distribution State

1. add the compact stepper
2. add the `Distribution` card
3. move public listing toggle here
4. point each row to one clear action surface

### Step D. Clean Up Copy And Actions

1. `Publish` -> `Make Live`
2. `Published` -> `Listed in Arcade`
3. `Configuration` -> `Self-Hosted`
4. make localhost and external hosting explicitly belong to the self-hosted lane

### Step E. Remove Leftover Old-Model Language

1. audit docs
2. audit route labels and breadcrumbs
3. audit schema and API names
4. remove any UI that still implies the external URL is the public Arcade source of truth

## Recommended First Technical Shape

The cleanest first version is:

1. platform app owns release records and dashboard UX
2. one small storage module handles artifact upload, extraction, and hosted asset lookup
3. one small release service owns validation and state transitions
4. public Arcade resolves hosted release URLs instead of raw self-hosted URLs

The first version should not require a separate service boundary.

It should live in the current platform app until cloud-only operational complexity genuinely justifies extraction.

## V1 Storage Decision

The first implementation should use Cloudflare R2 for artifact storage.

This is the intended v1 provider decision for hosted public releases.

Why R2 is the right first choice:

1. object storage matches uploaded zip artifacts and extracted static release files well
2. it supports a clean immutable asset model
3. it fits the static-only hosted release boundary
4. it avoids inventing a custom file service too early
5. it gives the platform a real hosted artifact substrate without turning Air Jam into a general-purpose hosting platform

The code should still keep a provider-neutral storage interface.

That means:

1. v1 chooses R2 operationally
2. the implementation should not scatter raw provider assumptions across the codebase

## V1 Storage Split

Storage responsibilities should be split explicitly:

### Postgres Stores Metadata

1. games
2. releases
3. release artifacts
4. release checks
5. live release pointers
6. publish and quarantine timestamps

### Cloudflare R2 Stores Blobs

1. uploaded zip artifacts
2. extracted hosted release files
3. release screenshots and other derived static inspection assets if we keep them

## Workstreams

### 1. Product And Data Model

Define the canonical model for:

1. games
2. releases
3. artifact storage metadata
4. release states
5. live-release selection
6. publish timestamps and rollback targets

Minimum schema concepts:

1. `game_releases`
2. `release_artifacts`
3. `release_checks`
4. `live_release_id` or equivalent live-pointer model

### 2. Storage And Serving

Add the minimal hosted deployment substrate:

1. object storage bucket for uploaded zips
2. extracted static output storage
3. immutable path layout per game and release
4. public static serving strategy in front of R2
5. cache policy for immutable assets

Recommended R2 key shape:

1. `/games/{gameId}/releases/{releaseId}/artifact.zip`
2. `/games/{gameId}/releases/{releaseId}/site/...`
3. `/games/{gameId}/releases/{releaseId}/screenshots/...`

### 3. Artifact Validation

Before a release can go live, validate:

1. artifact is a real zip
2. extracted payload stays within limits
3. required entry file exists
4. no path traversal
5. output is static-hostable
6. release metadata is internally consistent

The goal is not to understand every framework.

The goal is to accept Air Jam-compatible static output safely.

### 4. Dashboard And Creator UX

Reshape the dashboard around releases instead of one mutable hosted URL.

Needed surfaces:

1. upload release
2. view release status
3. set live release
4. rollback
5. inspect check failures
6. view hosted public URL

The old URL field should be reframed as self-hosted/external mode, not as the primary public Arcade publish primitive.

### 5. Public Arcade Launch Path

Change the public Arcade and platform launch flow so it resolves:

1. live release
2. hosted Air Jam URL for that release
3. release-aware metadata

It should stop treating the creator-controlled external URL as the canonical public play source.

### 6. Auth And Runtime Integration

Keep runtime auth honest and simple:

1. self-hosted games may continue using app ID and optional host-grant flows
2. hosted public Arcade releases should use Air Jam-controlled release URLs
3. future release-bound host grants should be compatible with the same model

Do not try to prove "real SDK usage" as the trust primitive.

The trust primitive should be the release object and hosted URL under Air Jam control.

### 7. Moderation And Abuse Controls

Add release-based safety checks and controls:

1. screenshot capture
2. optional image moderation pipeline
3. report abuse surface
4. admin quarantine
5. instant unpublish by release state

This should be automated-first, not manual-review-first.

Current implementation status:

1. canonical screenshot capture exists
2. image moderation exists
3. publish now blocks on moderation success
4. public users can report a hosted release from the play page
5. creators can see reports and manually quarantine from the release dashboard

### 8. Documentation

Update docs to reflect the new model clearly:

1. framework docs must preserve self-hosting as first-class
2. platform docs must explain artifact-based public Arcade publishing
3. deployment docs must define the split between self-hosted runtime and hosted public distribution
4. future AI Studio docs should point to the same release model

### 9. Operations

Add the minimum operational baseline:

1. bucket lifecycle policy
2. upload size limits
3. release cleanup rules
4. moderation failure handling
5. auditability for publish and takedown actions

This should stay lightweight at first and should not require a separate private service yet.

## Concrete Execution Sequence

This is the recommended professional implementation order.

The order matters because it keeps the public cutover late and keeps scope under control.

### Step 0. Freeze The Product Boundary

Before implementation starts, adopt these product rules explicitly:

1. `game.url` remains the self-hosted and external-play field
2. public Arcade will move to hosted immutable releases
3. release work must not silently expand into generic deployment infrastructure

Done when:

1. docs and product language consistently use this split
2. no new feature work deepens the mutable public URL path

### Step 1. Add The Canonical Release Data Model

Build the new database model first, before storage or UI work.

Add:

1. `game_releases`
2. `release_artifacts`
3. `release_checks`
4. `games.live_release_id` or equivalent live-selection relation

Recommended release fields:

1. `id`
2. `game_id`
3. `version_label`
4. `source_kind` such as `upload` for the first slice
5. `status`
6. `created_at`
7. `uploaded_at`
8. `checked_at`
9. `published_at`
10. `quarantined_at`

Recommended artifact fields:

1. `release_id`
2. `original_filename`
3. `content_type`
4. `size_bytes`
5. `zip_object_key`
6. `site_root_key`
7. `entry_path`
8. `content_hash`

Recommended check fields:

1. `release_id`
2. `check_kind`
3. `status`
4. `summary`
5. `payload`
6. `created_at`

Repo touchpoints:

1. `apps/platform/src/db/schema.ts`
2. `apps/platform/drizzle/*`

Done when:

1. the schema supports releases without changing self-hosted URL behavior yet
2. one game can own multiple releases
3. one release can be selected as live

### Step 2. Introduce Release-Focused Server Boundaries

Do not keep overloading `gameRouter` forever.

Add a dedicated release service boundary in the platform app.

Recommended shape:

1. keep `gameRouter` for game metadata and self-hosted settings
2. add a `releaseRouter` for upload, list, publish, rollback, and inspection
3. add a small domain/service module for release state transitions

Expected actions:

1. create draft release
2. request upload target
3. finalize uploaded artifact
4. run validation
5. publish release
6. quarantine release
7. set live release
8. list release history

Repo touchpoints:

1. `apps/platform/src/server/api/root.ts`
2. `apps/platform/src/server/api/routers/game.ts`
3. new `apps/platform/src/server/api/routers/release.ts`
4. new `apps/platform/src/server/releases/*` or equivalent

Done when:

1. release behavior has a clear server boundary
2. release state changes are not spread across UI handlers

### Step 3. Build The Storage Adapter And Artifact Lifecycle

Add the smallest possible hosted deployment substrate.

Needed capabilities:

1. issue upload target
2. store uploaded zip
3. extract zip safely
4. write extracted static files to immutable release paths
5. resolve hosted asset URLs for a release

Design rules:

1. storage adapter should hide vendor-specific APIs
2. extraction must reject path traversal and oversized payloads
3. extracted asset paths must be immutable and content-addressable enough for cache safety

Recommended module shape:

1. `storage-provider.ts`
2. `release-artifact-service.ts`
3. `release-extraction-service.ts`

V1 provider implementation:

1. implement the first storage provider against Cloudflare R2
2. keep the provider interface open enough for future replacement or extension

Repo touchpoints:

1. new `apps/platform/src/server/storage/*`
2. new `apps/platform/src/server/releases/*`
3. environment docs and config surfaces

Done when:

1. one uploaded zip can become one stored immutable hosted release
2. hosted asset URL resolution is deterministic
3. storage provider choice is isolated behind one interface

### Step 4. Add Artifact Validation Before Public Use

Do not make moderation the first check.

First add strict artifact validation:

1. zip integrity
2. allowed file count and size limits
3. required HTML entrypoint
4. static-hostable structure
5. no illegal archive paths
6. optional release metadata sanity

This should run before any release can become `ready`.

Repo touchpoints:

1. new `apps/platform/src/server/releases/release-validation.ts`
2. `releaseRouter`

Done when:

1. malformed or unsafe artifacts fail early
2. validation results are stored in `release_checks`

### Step 5. Add Dashboard Release UX Beside Existing Game UX

Do not rewrite the whole dashboard.

Add a release lane beside the existing game metadata/settings flow.

Recommended dashboard changes:

1. add a `Releases` section or page under each game
2. show current live release
3. show release history
4. allow upload of a new artifact
5. show validation or moderation failures
6. allow publish and rollback

Keep the current settings page, but reframe:

1. `Game URL` becomes self-hosted/external mode
2. hosted public Arcade release becomes a release concern, not a game-settings field

Repo touchpoints:

1. `apps/platform/src/app/dashboard/games/[gameId]/page.tsx`
2. `apps/platform/src/app/dashboard/games/[gameId]/settings/page.tsx`
3. new `apps/platform/src/app/dashboard/games/[gameId]/releases/page.tsx`
4. `apps/platform/src/components/app-sidebar.tsx`

Done when:

1. creators can understand the difference between self-hosted and hosted-release modes
2. release operations are usable without touching raw database state

### Step 6. Add Hosted Release Resolution In Platform Runtime

Before public cutover, teach the platform how to launch hosted releases.

This means:

1. `ArcadeGame` data should be able to carry hosted release URL separately from self-hosted URL
2. public lookup should resolve the live hosted release
3. preview and dashboard launch rules should be explicit about which source they use

Recommended transition rule:

1. dashboard preview may continue to support self-hosted URL preview
2. public Arcade should target hosted live release once cut over

Repo touchpoints:

1. `apps/platform/src/lib/arcade-game-mapper.ts`
2. `apps/platform/src/components/arcade/arcade-system.tsx`
3. `apps/platform/src/components/arcade/game-player.tsx`
4. `apps/platform/src/app/arcade/[[...slug]]/page.tsx`
5. `apps/platform/src/app/play/[slugOrId]/page.tsx`

Done when:

1. the platform can launch a hosted release without relying on `game.url`
2. source selection is explicit in code

### Step 7. Cut Public Arcade Over To Hosted Releases

Only after upload, storage, validation, and hosted resolution exist should public Arcade switch its source of truth.

Rules for the first cut:

1. only games with a live hosted release appear in the public Arcade
2. self-hosted external URL games remain usable outside that public Arcade lane
3. public play pages should resolve hosted live release, not mutable self-hosted URLs

This is the key product cutover.

Done when:

1. public Arcade does not rely on creator-controlled mutable URLs anymore
2. existing self-hosted framework usage still works

### Step 8. Add Moderation, Reporting, And Quarantine

Once public Arcade is backed by immutable releases, add the policy layer that makes it professionally safe.

Minimum moderation slice:

1. capture screenshot after extraction
2. run automated image moderation
3. store results in `release_checks`
4. prevent `live` if hard-fail checks fail
5. add report-abuse surface
6. add admin quarantine and unpublish

Keep this automated-first.

Repo touchpoints:

1. release service modules
2. dashboard release pages
3. public Arcade/report UI
4. docs

Done when:

1. bad releases can be stopped by state
2. the public safety model is release-based instead of URL-based

### Step 9. Add Release Management Polish

After the trusted public-release base exists, add the usability layer:

1. rollback to previous live release
2. better release status inspection
3. release notes or labels
4. improved failure summaries

This should happen after the trust model is already correct.

## Repo Touchpoint Summary

The first implementation should mostly affect these areas:

### Database

1. `apps/platform/src/db/schema.ts`
2. `apps/platform/drizzle/*`

### Platform server

1. `apps/platform/src/server/api/root.ts`
2. `apps/platform/src/server/api/routers/game.ts`
3. new `apps/platform/src/server/api/routers/release.ts`
4. new `apps/platform/src/server/releases/*`
5. new `apps/platform/src/server/storage/*`

### Dashboard UI

1. `apps/platform/src/app/dashboard/games/[gameId]/page.tsx`
2. `apps/platform/src/app/dashboard/games/[gameId]/settings/page.tsx`
3. new `apps/platform/src/app/dashboard/games/[gameId]/releases/page.tsx`
4. `apps/platform/src/components/app-sidebar.tsx`

### Public launch path

1. `apps/platform/src/lib/arcade-game-mapper.ts`
2. `apps/platform/src/app/arcade/[[...slug]]/page.tsx`
3. `apps/platform/src/app/play/[slugOrId]/page.tsx`
4. `apps/platform/src/components/arcade/arcade-system.tsx`
5. `apps/platform/src/components/arcade/game-player.tsx`

### Documentation

1. dashboard docs
2. deployment docs
3. public Arcade docs
4. self-hosting docs

## Migration Rules

This work should follow these migration constraints:

1. do not delete `game.url` early
2. do not collapse self-hosted and hosted-release concepts into one field
3. do not make public Arcade cutover before hosted release resolution is working end-to-end
4. do not hide product differences between self-hosted play and public Arcade hosting
5. do not add Git-connected or managed-build concerns until the artifact path is stable

## Recommended Milestones

These milestones should be treated as the concrete delivery ladder.

### Milestone A. Release Model Exists

Includes:

1. schema
2. release router
3. state machine

### Milestone B. Upload And Hosting Works

Includes:

1. storage adapter
2. zip upload
3. extraction
4. hosted immutable site URL

### Milestone C. Dashboard Release UX Works

Includes:

1. release list
2. upload UX
3. live-release selection
4. failure inspection

### Milestone D. Public Arcade Uses Hosted Releases

Includes:

1. mapper and route cutover
2. public launch from live release
3. self-hosted path still preserved

### Milestone E. Moderation And Quarantine Exist

Includes:

1. screenshot checks
2. report abuse
3. quarantine and unpublish

## Rollout Sequence

### Phase 1. Canonical Model

1. define release schema and status model
2. define storage layout
3. define dashboard information architecture
4. define how live release selection works

### Phase 2. Minimal Upload And Hosting

1. upload static zip
2. validate and extract
3. serve immutable hosted release URL
4. show release in dashboard

### Phase 3. Public Arcade Cutover

1. make public Arcade resolve hosted live release
2. keep external URL mode available outside the public Arcade path
3. preserve self-hosted runtime documentation and support

### Phase 4. Moderation And Admin Controls

1. screenshot capture
2. automated checks
3. report abuse
4. quarantine and unpublish controls

### Phase 5. Release Management UX

1. rollback
2. release history
3. better failure inspection
4. clearer publish state transitions

### Phase 6. Future Inputs

Once the artifact model is stable, add:

1. Git-connected deploys
2. AI Studio publish API
3. future hosted convenience features

## Suggested Immediate Next Action

The next concrete implementation step should be:

1. finalize the release schema
2. define the storage adapter interface
3. define the first `releaseRouter` contract

Those three decisions should happen before any UI or bucket wiring work begins.

## Contract Freeze Before Coding

Before implementation starts, these decisions should be made explicitly and treated as frozen for the first slice.

This is the minimum design lock we want before writing schema or server code.

### 1. Hosted URL Shape

V1 decision:

1. use one dedicated hosted release origin instead of mixing release serving into normal platform app page routes
2. keep release asset paths stable and predictable

V1 shape:

1. `https://releases.air-jam.app/g/{gameId}/r/{releaseId}/...`

Notes:

1. it affects storage keys, caching, public routing, and asset resolution
2. it is much cleaner than making the main platform app own both product pages and release asset serving semantics

### 2. Accepted Artifact Contract

V1 decision:

1. v1 accepts one zip containing static output only
2. accept either:
   a. `index.html` at the archive root
   b. one single wrapping directory whose root contains `index.html`
3. normalize the extracted site root to the directory that contains `index.html`
4. reject:
   a. archives with multiple competing site roots
   b. path traversal entries
   c. absolute paths
   d. symlinks and special filesystem entries
   e. server runtimes or non-static deploy assumptions
5. treat the artifact as immutable release output, not as source code or a build input
6. require the hosted site root to be static-hostable as plain files behind the release origin

Notes:

1. validation rules should follow the product boundary, not invent it later
2. this prevents accidental scope creep into "support every frontend deployment style"

### 3. Release State Machine

V1 decision:

1. `draft`
2. `uploading`
3. `checking`
4. `ready`
5. `live`
6. `failed`
7. `quarantined`
8. `archived`

Legal transitions:

1. `draft -> uploading`
2. `uploading -> checking`
3. `uploading -> failed`
4. `checking -> ready`
5. `checking -> failed`
6. `checking -> quarantined`
7. `ready -> live`
8. `ready -> archived`
9. `live -> archived`
10. `live -> quarantined`
11. `failed -> archived`
12. `quarantined -> archived`

Rules:

1. `live` is the only publicly launchable state
2. only one release per game may be `live` at a time
3. `archived` releases are immutable historical records, not editable drafts

Notes:

1. it drives schema, UI, background checks, and moderation behavior
2. it prevents state logic from leaking into ad hoc booleans later

### 4. Public Source-Of-Truth Rule

V1 decision:

1. public Arcade resolves `live_release_id` or equivalent hosted live-release selection
2. `game.url` remains self-hosted and external-play only
3. `/arcade` and public play routes must not launch from mutable self-hosted URLs once the hosted release cutover is complete

Notes:

1. it is the core cutover rule
2. it keeps the product model clean and prevents another hybrid muddle

### 5. Dashboard Information Architecture

V1 decision:

1. keep `Settings` for self-hosted/external mode and general game metadata
2. add a dedicated `Releases` surface for artifact upload, release status, live selection, and rollback
3. do not mix hosted release state into the old mutable URL form
4. the game overview page should summarize:
   a. current live hosted release
   b. self-hosted URL if present
   c. whether the game is Arcade-public through hosted release or external-only

Notes:

1. it avoids confusing creators with one page trying to express two deployment models
2. it keeps future Git and AI publish inputs compatible with the same release surface

### 6. Moderation Scope For The First Slice

V1 decision:

1. artifact validation is blocking before a release can become `ready`
2. screenshot capture is required before a release can become `live`
3. automated image moderation is blocking before a release can become `live`
4. report-abuse and admin quarantine are required for the public Arcade cutover
5. `release_checks` must support both:
   a. structural checks
   b. policy checks

Practical rollout rule:

1. Milestone B may ship with structural validation only
2. Milestone D public Arcade cutover must not ship until screenshot capture, image moderation, and quarantine exist

Notes:

1. it prevents us from baking in a release model that cannot express policy checks properly
2. it keeps the first implementation honest about what is enforced versus what is future work

### 7. Upload And Asset Limits

V1 decision:

1. max uploaded zip size: `100 MB`
2. max extracted site size: `250 MB`
3. max file count after extraction: `5,000`
4. max individual file size: `25 MB`
5. accept only regular files and directories inside the archive
6. reject symlinks, device files, and other special entries

Notes:

1. validation and storage code should be written against real constraints
2. this keeps the hosted release lane focused on static games rather than turning into an unbounded file-hosting surface

## V1 Server Contract Decisions

These should also be treated as frozen for the first implementation slice.

### `releaseRouter` Responsibilities

V1 decision:

1. create draft release
2. request artifact upload target
3. finalize uploaded artifact
4. list releases for a game
5. get one release with checks and artifact metadata
6. publish one ready release
7. archive one release
8. quarantine one release
9. rollback by selecting a previous ready release as live

### Schema Boundary Rule

V1 decision:

1. `gameRouter` continues to own game metadata and self-hosted URL settings
2. `releaseRouter` owns hosted release lifecycle
3. hosted release state must not be backfilled into `games.url` or similar legacy fields

## Ready-To-Start Rule

We are ready to start implementation once these are frozen:

1. hosted release URL shape
2. accepted artifact contract
3. release state machine
4. public source-of-truth rule
5. dashboard IA split
6. first-slice moderation scope
7. upload and asset limits

After that, coding should start with:

1. schema
2. storage adapter interface
3. `releaseRouter`

## Done Criteria

This plan is complete enough for the first professional version when:

1. public Arcade launches only Air Jam-hosted immutable releases
2. self-hosted external URL usage remains supported outside that lane
3. creators can upload a static build artifact without extra backend ceremony
4. releases have explicit lifecycle states
5. a bad release can be quarantined instantly
6. docs explain the new model clearly and consistently

## Design Rules

Implementation should follow these constraints:

1. keep self-hosting first-class
2. keep the hosted release model static-only at first
3. do not build broad cloud infrastructure prematurely
4. keep release state authoritative
5. prefer one canonical release model over multiple special-case publish pipelines

## Open Questions

These are design questions to resolve during implementation, not blockers for the direction itself:

1. whether live-release serving should sit inside the platform app or a dedicated static asset edge path in front of R2
2. how much release-bound auth capability work should ship in the first slice versus a later hardening phase
