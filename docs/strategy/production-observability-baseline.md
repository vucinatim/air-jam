# Air Jam Production Observability Baseline

Last updated: 2026-08-26
Status: stable baseline

Related docs:

1. [Framework Paradigm](../framework-paradigm.md)
2. [Analytics Architecture](../architecture/analytics-architecture.md)
3. [Product Telemetry Architecture](../architecture/product-telemetry-architecture.md)
4. [Product Telemetry Contract](../contracts/product-telemetry-contract.md)
5. [Deployment Topology](./deployment-topology.md)
6. [Railway Deployment Guide](../guides/railway-deployment-guide.md)

## Purpose

This document defines the intended production observability baseline for Air Jam at prerelease and early public adoption.

It exists to make four things explicit:

1. which external tools Air Jam should rely on now
2. which internal observability systems are already canonical
3. which tools are intentionally deferred
4. how to keep the stack minimal without flying blind

## Core Position

Air Jam should not adopt a large generic observability stack by default.

The current product stage needs:

1. external uptime truth
2. lightweight public-site traffic visibility
3. lightweight public-site performance visibility
4. authoritative runtime usage truth
5. straightforward provider log access for debugging

It does not yet need:

1. a full product analytics suite
2. a heavy error-monitoring rollout across every app and package
3. a custom observability platform
4. multiple overlapping analytics systems that disagree with each other

## Current Baseline

Air Jam now treats the following as the canonical prerelease observability stack:

### 1. Better Stack Uptime

Use Better Stack as the external uptime authority.

Why:

1. it lives outside the Railway footprint
2. it answers the simplest high-value question first: is the product up
3. it avoids self-hosting another operational service before release

Expected checks:

1. public platform homepage
2. platform login page
3. runtime server health endpoint

### 2. Website Traffic Visibility

Air Jam's first-party product telemetry plane is the canonical source of
approximate public discovery evidence.

It records:

1. canonical public page views
2. ephemeral anonymous browsing sessions
3. normalized referrer and campaign sources
4. typed quick-start, scaffold-copy, Arcade-entry, and allowlisted external-link
   intent
5. human, bot, agent, and unknown traffic splits
6. server-observed requests for canonical agent-facing resources

Reference:
[Product Telemetry Architecture](../architecture/product-telemetry-architecture.md)

Do not infer website visits from:

1. runtime room sessions
2. npm downloads
3. GitHub's rolling traffic window
4. provider request volume

Those are different signals with different authority boundaries.

Runtime gameplay and monetization facts remain owned by Air Jam Runtime
Analytics. Browser-observed product telemetry must not become a second source
of gameplay truth.

Platform account, game, and release lifecycle records remain authoritative for
their own facts. The ops reporting surface may align all three evidence groups
over the same time window, but it labels them separately and does not claim
causation.

Anonymous sessions are in-memory, page-context measures. They are not durable
identities or unique people. The platform does not persist raw IP addresses,
full user agents, full URLs, query strings, raw referrers, or fingerprint data.

### 3. Air Jam Runtime Analytics

Use Air Jam's own runtime analytics system as the authoritative usage and product-truth layer.

Reference: [Analytics Architecture](../architecture/analytics-architecture.md)

Why:

1. it is server-observed
2. it stays compatible with quotas, monetization, and future creator rewards
3. it avoids turning browser beacons into billing-grade truth

This remains the canonical source for:

1. room and session usage
2. controller participation
3. eligible playtime
4. game-level creator analytics

### 4. Provider Logs

Use Railway logs and the existing Air Jam local and dev log systems for operational debugging.

Why:

1. they already exist
2. they keep the stack small
3. they are sufficient until real production debugging pain proves otherwise

### 5. Platform Error Tracking

The platform contains a minimal optional Sentry integration for server, edge,
client, and global-render failures.

It is active only when the required Sentry environment is configured. This is
a narrow platform capability, not evidence that the realtime server, embedded
games, or controller/browser-runtime surfaces have equivalent coverage.

## What Is Intentionally Deferred

The following are intentionally not part of the prerelease baseline:

### 1. Broader Sentry Coverage

Broader server and browser-runtime coverage remains deferred because:

1. the minimal platform integration already covers the first-party web control
   surface
2. provider logs and runtime analytics remain the stronger current tools for
   realtime-server and gameplay failure stories
3. expansion should follow real production debugging pain instead of assuming
   every surface needs the same vendor integration

If broader coverage becomes necessary, add the smallest correct release-aware
server and browser-runtime baseline in one intentional pass.

### 2. PostHog

Deferred because:

1. Air Jam already has its own authoritative runtime analytics direction
2. PostHog would introduce a second product analytics model too early
3. the current product stage does not need advanced funnel tooling badly enough

### 3. Custom RUM Or Performance Stack

Deferred because:

1. Railway hosting does not force a separate RUM choice yet
2. the current public surface can live with provider logs, manual performance
   verification, and the first-party product telemetry boundary
3. we should add a dedicated performance tool only when real pain appears

### 4. Custom Observability Infrastructure

Deferred because:

1. Air Jam should not build its own monitoring product at this stage
2. infrastructure effort should go into the framework, platform, and Studio direction first

## Decision Rules

When considering a new observability tool, ask:

1. does it provide a capability the current stack does not already cover
2. is it external truth, performance visibility, runtime truth, or operational debugging
3. does it duplicate an existing system with a weaker authority model
4. does it create more maintenance burden than product value

Default rule:

1. prefer one tool per job
2. prefer authoritative server-observed product truth over browser-side approximations
3. prefer hosted external uptime over self-hosted monitoring during early release

## Triggers For Expanding The Stack

Add more observability only when one of these becomes true:

1. production failures are hard to diagnose from existing logs
2. platform frontend and discovery questions cannot be answered from first-party
   product telemetry and provider logs
3. creator and product questions require richer hosted rollups than the current analytics surface provides
4. support load grows enough that structured error correlation becomes clearly worth it

## Current Recommendation

For prerelease and the first meaningful wave of public users, the right Air Jam observability stack is:

1. Better Stack uptime
2. first-party product telemetry for approximate discovery and intent evidence
3. Air Jam runtime analytics
4. provider logs
5. optional platform Sentry when configured

Anything more should wait for real evidence.
