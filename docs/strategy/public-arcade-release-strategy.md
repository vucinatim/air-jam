# Air Jam Public Arcade Release Strategy

Last updated: 2026-03-30  
Status: active strategy

Related docs:

1. [Framework Paradigm](../framework-paradigm.md)
2. [Deployment and Monetization Strategy](./deployment-and-monetization-strategy.md)
3. [Auth Capability Plan (Archived)](../archive/auth-capability-plan-2026-03-31.md)
4. [AI Studio Architecture](../systems/ai-studio-architecture.md)
5. [Public Arcade Artifact Release Plan (Archived)](../archive/public-arcade-artifact-release-plan-2026-03-31.md)

## Purpose

This document defines the intended product direction for public Arcade publishing.

It exists to answer one question clearly:

1. should the public Arcade keep trusting mutable external URLs, or should it move to immutable Air Jam-controlled releases

The intended answer is:

1. self-hosting stays first-class
2. public Arcade should move to immutable Air Jam-hosted static releases

## Core Decision

Air Jam should keep two distinct publishing lanes.

### Lane 1. Self-Hosted Runtime

Developers should always be able to:

1. build with `@air-jam/sdk`
2. deploy on Vercel, Netlify, Cloudflare, custom hosting, or anywhere else
3. use the official Air Jam realtime server if they want
4. stay outside the public Arcade if they do not want hosted distribution

This lane preserves openness and low lock-in.

### Lane 2. Public Arcade Distribution

The public Arcade should not depend on mutable creator-controlled URLs.

It should instead publish and launch:

1. immutable static build artifacts
2. stored and served from Air Jam-controlled infrastructure
3. versioned as explicit releases
4. moderated and revocable by release state

This lane provides trusted public distribution.

## Product Surface Model

The product should expose three separate creator-facing concepts, not one overloaded "published game" concept:

1. `Preview URL`
2. `Arcade Release`
3. `Arcade Visibility`

These answer different questions:

1. `Preview URL`
   Which optional creator-only URL should Air Jam iframe for private localhost, staging, or external preview?
2. `Arcade Release`
   Which immutable Air Jam-hosted artifact should the platform load for trusted hosted distribution?
3. `Arcade Visibility`
   Should the game appear in the public Arcade catalog?

This separation is important because public discovery and hosted artifact selection are no longer the same action.

The same boundary should also apply to catalog media:

1. thumbnails
2. covers
3. preview videos

Those public-facing assets should not stay as arbitrary third-party URLs long-term.

## Why External URLs Are Not The Right Public Arcade Primitive

Mutable external URLs are acceptable for drafts and self-hosted play, but they are the wrong primitive for a public catalog.

The core problem is not only malicious intent.

The deeper product problem is that URL-based public publishing makes Air Jam trust content it does not control after the moment of publish.

That creates structural weaknesses:

1. a creator can change site contents after approval or verification
2. public Arcade moderation becomes reactive instead of enforceable
3. takedowns and quarantines become incomplete because the artifact itself is not under Air Jam control
4. future release history, rollback, and version UX stay weak
5. AI-native publishing later has no stable canonical release object to target

The result is a system that looks simple early but gets harder to defend as soon as public discovery matters.

## Why Artifact Releases Are The Right Public Primitive

Immutable artifact releases solve the actual trust problem instead of layering policy around the wrong object.

The public object becomes:

1. a game
2. a release
3. a stored immutable artifact
4. a release status
5. a live public URL served by Air Jam

That gives Air Jam the right control points:

1. pre-publish validation
2. screenshot and media moderation
3. explicit `draft` / `checking` / `live` / `quarantined` release states
4. rollback and release history
5. instant disable by changing release state rather than chasing a third-party origin

## Product Benefits We Want

This direction is worth it because it creates product advantages, not just security posture.

### 1. A Trustworthy Public Arcade

Public users should feel that Arcade is a real curated platform surface, not a loose iframe directory.

Artifact releases make that believable.

### 2. A Clean Open Product Story

Air Jam stays open because self-hosting still works.

Air Jam becomes stronger because public distribution uses a trusted hosted release model.

That is a coherent split:

1. open framework and optional official runtime
2. trusted hosted distribution layer

That split should be obvious in the dashboard IA too:

1. `Self-Hosted` for localhost and external hosting
2. `Arcade Releases` for immutable public-distribution artifacts
3. `Arcade visibility` as a separate listing control
4. `Media` for Air Jam-managed catalog assets

### 3. Better Creator UX Over Time

Once releases are first-class objects, the platform can add:

1. release history
2. release notes
3. rollback
4. version comparisons
5. staged publish flows
6. future Git-connected deploys

Without artifact releases, all of those stay awkward.

The same is true for game media. If thumbnails, covers, and preview videos stay as raw URLs, the catalog remains visually dependent on infrastructure Air Jam does not control.

### 4. A Real Foundation For AI Studio

Future Air Jam Studio agents should publish build artifacts into a stable deploy API.

Artifact releases are the cleanest shared primitive between:

1. human uploads
2. Git-driven builds
3. generated builds from AI tooling

### 5. Better Abuse Control Without Manual Review

Air Jam should not require manual approval for every release.

The right model is automated enforcement:

1. upload artifact
2. validate structure
3. capture screenshot
4. run scanning and moderation
5. publish if checks pass
6. quarantine if checks fail

That keeps publishing fast without trusting mutable public URLs forever.

## Product Boundaries

This strategy should not accidentally turn Air Jam into a general-purpose hosting company.

### What Air Jam Should Build

1. static artifact upload
2. static artifact storage
3. immutable release records
4. release state transitions
5. public Arcade serving for those releases
6. future Git and AI publishing against the same release model

For the first hosted release slice, the intended storage split is:

1. Postgres for release metadata and state
2. Cloudflare R2 for uploaded artifacts, extracted static release assets, and managed game media assets

### What Air Jam Should Not Build Yet

1. arbitrary build runners
2. full CI hosting
3. server-side rendering support
4. general-purpose app hosting
5. broad non-game platform infrastructure
6. a Vercel clone

The public product boundary should stay:

1. Air Jam-compatible static games
2. trusted hosted release and discovery
3. trusted managed catalog media

## Professional Security Position

Air Jam should stop trying to prove that a public site is permanently "really using the SDK."

That is the wrong trust target in the browser.

The professional trust target is:

1. this release artifact was uploaded through Air Jam
2. this release artifact passed policy checks
3. this release artifact is still marked live
4. the public Arcade serves this exact artifact

This is more honest and more enforceable than trying to fingerprint browser code.

The same principle should apply to media:

1. this thumbnail, cover, or preview video was uploaded through Air Jam
2. this asset passed basic validation
3. this asset is the one assigned to the game
4. public surfaces render this exact managed asset

## Release State Model

Public distribution should revolve around explicit release states.

Recommended baseline:

1. `draft`
2. `uploading`
3. `checking`
4. `ready`
5. `live`
6. `failed`
7. `quarantined`
8. `archived`

## Visibility Model

The old boolean `isPublished` no longer describes the real system well enough.

The product now has:

1. release promotion
2. public listing

Those should not share one ambiguous label.

The intended replacement is:

1. `arcadeVisibility: hidden | listed`

This is a better long-term contract because it describes catalog visibility directly instead of implying that one publish action controls everything.

This is the minimum professional shape for moderation, support, and future rollback.

This contract is now the implemented platform direction rather than a deferred rename.

In the implemented platform contract, `listed` is only valid when a game also has a live hosted release. Public catalog visibility is not an independent promise without a live Arcade release behind it.

## Media Position

Public game media should become a first-class managed subsystem.

Air Jam should stop relying on raw external `thumbnailUrl`, `coverUrl`, and `videoUrl` fields for public catalog surfaces.

The right product model is:

1. game media assets are uploaded into Air Jam-managed storage
2. games reference managed assets, not arbitrary third-party URLs
3. public catalog and landing surfaces render stable Air Jam media URLs

For the first version, this should use the same Cloudflare R2 bucket as hosted releases with separate object-key prefixes, not a second bucket.

This is now the implemented platform direction as well: managed media uses the same R2 bucket with separate prefixes and the public platform serves stable `/media/...` URLs.

## Moderation Position

Public Arcade moderation should be release-based, not URL-based.

Recommended enforcement model:

1. validate uploaded artifact structure
2. capture canonical screenshots
3. run automated URL and image checks where relevant
4. keep report-abuse and one-click takedown
5. quarantine by release state

This allows fast self-serve publishing without requiring manual pre-approval.

## Future-Proofing

This direction should intentionally unlock future capabilities without changing the mental model later.

Artifact releases should become the shared base for:

1. direct uploaded builds
2. Git-connected deploys
3. Air Jam Studio generated builds
4. release analytics
5. monetized hosted deployment tiers
6. version rollback and release comparison

That way Air Jam evolves by adding inputs to one canonical release model instead of inventing new pipelines for each future product.

## Recommended Product Rule

Air Jam should adopt this platform rule:

1. self-hosted URLs remain valid for external and private use
2. public Arcade distribution uses Air Jam-hosted immutable releases

That is the cleanest long-term line.

## Decision Summary

Air Jam should not keep building public Arcade around mutable external URLs.

The right long-term move is:

1. keep self-hosting first-class
2. add artifact upload as the canonical public Arcade release primitive
3. make public Arcade launch only trusted immutable releases

This is a meaningful undertaking, but it reduces future complexity instead of adding accidental product debt.
