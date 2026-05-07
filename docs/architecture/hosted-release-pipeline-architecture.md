# Hosted Release Pipeline Architecture

Last updated: 2026-05-08  
Status: implemented architecture

Related docs:

1. [../strategy/public-arcade-release-strategy.md](../strategy/public-arcade-release-strategy.md)
2. [../contracts/media-presentation-contract.md](../contracts/media-presentation-contract.md)
3. [../contracts/environment-contracts.md](../contracts/environment-contracts.md)
4. [../guides/hosted-release-guide.md](../guides/hosted-release-guide.md)
5. [../capability-inventory.md](../capability-inventory.md)

## Purpose

This document explains the hosted release pipeline as a product architecture,
not just as a set of CLI commands.

## Core Position

Air Jam hosted releases are built around one explicit lifecycle:

1. validate locally
2. bundle a release artifact
3. submit a draft
4. upload and finalize the artifact
5. run trusted checks
6. publish or reject the release

The important rule is that release serving is owned by Air Jam, not by ad hoc
external URLs.

## Main Planes

### Authoring Plane

Owned by the local project and local tools.

Responsibilities:

1. validate the game against Air Jam release rules
2. build the hosted artifact
3. produce a manifest that describes what is being submitted

### Control Plane

Owned by the hosted platform.

Responsibilities:

1. create and track release records
2. issue upload targets
3. own release state transitions
4. decide whether a release is publishable

### Check Plane

Owned by trusted server and worker processes.

Responsibilities:

1. artifact validation
2. screenshot capture
3. image moderation
4. transition releases into ready, failed, quarantined, or live states

### Serving Plane

Owned by the hosted platform and object storage contracts.

Responsibilities:

1. serve public hosted releases
2. keep release identity stable
3. separate playable artifacts from presentation media

## Canonical Nouns

### Release Draft

Represents a versioned candidate before it is publicly live.

### Release Artifact

Represents the uploaded playable build package.

### Release Manifest

Represents the machine-readable description of the build contract.

### Release Check Result

Represents trusted system-owned findings, not creator-reported confidence.

## State Model

The release state model should stay explicit and finite:

1. `draft`
2. `uploading`
3. `checking`
4. `ready`
5. `live`
6. `failed`
7. `quarantined`
8. `archived`

The platform should never blur these into vague "published-ish" states.

## Boundary Rules

1. Local tooling can prepare and submit a release, but cannot declare it safe.
2. The platform owns release state authority.
3. Check workers can produce evidence and outcomes, but do not own creator
   records.
4. Public serving should only happen through explicit live eligibility.
5. Media and release artifacts should remain separate assets with different
   lifecycle rules.

## Design Rules

1. Keep release nouns stable across CLI, MCP, dashboard, and public hosting.
2. Prefer explicit state transitions over hidden background magic.
3. Keep trusted checks provider-backed and machine-readable.
4. Treat hosted release serving as part of the product, not as a loose upload
   convenience.
