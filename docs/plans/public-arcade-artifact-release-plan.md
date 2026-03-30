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
4. `release status`
5. `live hosted URL`

The first professional publish flow should be:

1. creator uploads a static build artifact
2. platform validates and stores it immutably
3. platform creates a release record
4. automated checks run
5. release becomes `live` only after those checks pass
6. public Arcade launches the Air Jam-hosted release URL

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
4. public static serving strategy
5. cache policy for immutable assets

Recommended path shape:

1. `/games/{gameId}/releases/{releaseId}/artifact.zip`
2. `/games/{gameId}/releases/{releaseId}/site/...`

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

1. which object store and serving layer should back the first version
2. whether live-release serving should sit inside the platform app or a dedicated static asset edge path
3. what the exact release validation contract should be for accepted artifact structure
4. how much release-bound auth capability work should ship in the first slice versus a later hardening phase
