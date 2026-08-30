# Hosted Release Pipeline Architecture

Last updated: 2026-08-30
Status: implemented architecture

Related docs:

1. [../strategy/public-arcade-release-strategy.md](../strategy/public-arcade-release-strategy.md)
2. [../contracts/media-presentation-contract.md](../contracts/media-presentation-contract.md)
3. [../contracts/environment-contracts.md](../contracts/environment-contracts.md)
4. [../guides/hosted-release-guide.md](../guides/hosted-release-guide.md)
5. [../capability-inventory.md](../capability-inventory.md)
6. [../audits/v1-reliability/production-immutable-release-generations-proof.md](../audits/v1-reliability/production-immutable-release-generations-proof.md)

## Purpose

This document explains the hosted release pipeline as a product architecture,
not just as a set of CLI commands.

## Core Position

Air Jam hosted releases are built around one explicit lifecycle:

1. validate locally
2. bundle a release artifact
3. submit a draft
4. create, upload, and finalize an immutable generation
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
3. own candidate and promoted generation pointers
4. own release state transitions
5. decide whether a release is publishable

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

1. serve only the explicitly promoted ready generation
2. keep product release identity stable while every cacheable artifact URL
   includes immutable generation identity
3. separate playable artifacts from presentation media

## Canonical Nouns

### Release Draft

Represents a versioned candidate before it is publicly live.

### Release Generation

Represents one immutable uploaded playable build and its derived output. A new
upload creates a new generation rather than mutating an older artifact.

### Candidate Generation

Represents the one generation currently permitted to advance through upload
and validation for a release.

### Promoted Generation

Represents the one ready generation eligible for publishing and public
serving. Promotion is explicit; serving never discovers a generation by
recency or storage presence.

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
6. Every release check identifies the exact generation it evaluated.
7. A stale or superseded generation cannot change release-visible state.
8. Storage writes use immutable generation/output identity and create-only
   semantics; database state never relies on overwriting a shared key.
9. Managed-storage accounting includes all retained generations, not only the
   currently promoted output.
10. Public and operator projections expose semantic evidence without private
    object keys or raw internal check payloads.

## Design Rules

1. Keep release nouns stable across CLI, MCP, dashboard, and public hosting.
2. Prefer explicit state transitions over hidden background magic.
3. Keep trusted checks provider-backed and machine-readable.
4. Treat hosted release serving as part of the product, not as a loose upload
   convenience.
5. Keep the same release/generation contract across dashboard, HTTP, CLI, MCP,
   and future workers.
