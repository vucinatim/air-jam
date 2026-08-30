# Hosted Release Pipeline Architecture

Last updated: 2026-08-30
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

Owned by the hosted platform, its dedicated untrusted-content origin, and
object storage contracts.

Responsibilities:

1. serve public hosted releases
2. keep release identity stable
3. separate playable artifacts from presentation media
4. keep creator executable code outside the authenticated platform cookie site

### Release-Origin Security Boundary

Creator-controlled HTML, JavaScript, and CSS are untrusted executable content.
They must be served only through the origin configured by
`AIRJAM_RELEASES_PUBLIC_ORIGIN`.

That origin must:

1. be an absolute `https` origin in production
2. use a separate cookie site from the authenticated platform—not the platform
   origin, a sibling subdomain, or a parent domain
3. stay outside Better Auth trusted origins
4. carry no Air Jam authentication cookies or platform authority
5. remain explicit whenever hosted delivery is enabled; production requires it,
   while previews may deliberately report delivery as disabled
6. use the incoming HTTP `Host` authority for request classification; framework
   request URLs derived from the server bind address are not an origin boundary
7. match the platform identity baked into release `frame-ancestors` policy;
   runtime drift fails health until the application is rebuilt

Operators and agents inspect this boundary through the same runtime assessment:

```bash
pnpm run repo -- platform release-origin inspect
pnpm --silent run repo -- platform release-origin inspect --json
pnpm --silent run repo -- platform release-origin inspect --platform-url https://airjam.io --json
pnpm --silent run repo -- platform release-origin attest --platform-url https://airjam.io --release-url https://<release-domain>/releases/g/<game-id>/r/<release-id>/ --railway-project <project-id> --json
```

The machine response is versioned, contains no secrets, and reports `ready`,
`disabled`, or `invalid` with the effective public and platform origins needed
to diagnose the boundary. Local inspection evaluates the process environment;
`--platform-url` authoritatively reads the deployed platform's public health
contract with a bounded request.

The remote result preserves both layers of evidence: `health.httpStatus` and
`health.ok` describe the deployed platform, while `assessment` describes the
hosted-release boundary. A valid `503` health document is returned as an
unhealthy assessment rather than discarded as a transport error. Malformed or
unrecognized responses still fail closed.

`attest` is the deployed transport-evidence surface. It accepts only the
canonical live host root, derives the matching controller URL, resolves each
origin once, rejects non-public address sets outside explicit loopback
diagnostics, and pins every request to that resolution while retaining the
original Host and TLS server name. It verifies rather than trusting the health
claim alone:

1. platform and release hosts use distinct conservative cookie sites
2. deployed health names the exact required release origin
3. platform host and controller routes produce exact temporary, non-cacheable
   redirects
4. the release host blocks platform routes and sets no cookies
5. host and controller HTML carry the release CSP, Permissions Policy,
   referrer, resource, and content-class contract
6. the Better Auth browser-session endpoint and representative machine-auth,
   dashboard, device-poll, and device-approval endpoints return their exact
   anonymous or unauthenticated contract without release-origin CORS authority
7. provider deployment identity and the boundary remain stable from the first
   health read to the last

The output is timestamped and carries the deployment-reported environment,
deployment ID, and source revision. Production promotion then queries Railway
through a bounded provider client and independently binds the expected project,
production environment, platform service's current successful deployment, and
both public domains. The provider query does not independently authenticate the
revision field. Pass `--railway-project <project-id>` (or set
`RAILWAY_PROJECT_ID`) and configure `RAILWAY_PROJECT_TOKEN`,
`RAILWAY_API_TOKEN`, or `RAILWAY_TOKEN`. Missing project identity or provider
credentials keeps a passing transport result diagnostic. Loopback and preview
runs also remain `diagnostic`; only a provider-verified public-HTTPS Railway
production run is `productionEvidenceEligible`.

This is intentionally not named closure evidence: the command does not execute
creator code. Hostile browser containment and normal host/controller
functionality stay in controlled browser fixtures until the browser worker
itself has fail-closed authentication, sandboxing, private egress denial, and
resource limits under `AJ-SEC-004`. A maintainer CLI must never load arbitrary
live creator code directly on the maintainer machine.

The v1 containment contract protects the authenticated platform from untrusted
games; it does not claim that games are mutually confidential from each other.
All releases currently share the untrusted origin, and `allow-same-origin` is
required for normal module, asset, and browser-storage behavior. Games must not
place secrets on that origin. Per-game origins or opaque-origin execution remain
a possible later hardening step if game-to-game storage isolation becomes a
product requirement.

The release CSP still permits externally hosted resources needed by the current
game contract. As a result, artifact review proves the uploaded bundle but does
not make every remote dependency immutable. This is an explicit moderation and
takedown limitation for v1, not platform-authority exposure; executable-resource
pinning and archive validation should be tightened under the remaining Gate 5
artifact-abuse work.

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
6. Creator executable content must never share the authenticated platform's
   origin or cookie site.

## Design Rules

1. Keep release nouns stable across CLI, MCP, dashboard, and public hosting.
2. Prefer explicit state transitions over hidden background magic.
3. Keep trusted checks provider-backed and machine-readable.
4. Treat hosted release serving as part of the product, not as a loose upload
   convenience.
