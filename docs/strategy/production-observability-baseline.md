# Air Jam Production Observability Baseline

Last updated: 2026-05-08  
Status: stable baseline

Related docs:

1. [Framework Paradigm](../framework-paradigm.md)
2. [Analytics Architecture](../architecture/analytics-architecture.md)
3. [Deployment Topology](./deployment-topology.md)
4. [Railway Deployment Guide](../guides/railway-deployment-guide.md)

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

### 2. Umami Website Analytics

Use Umami for public-site traffic and high-level frontend usage visibility.

Why:

1. it is lightweight
2. it is already the platform's explicit website analytics integration
3. it gives enough public-surface signal without introducing a second product-truth system

This is for:

1. landing and docs traffic
2. general platform frontend usage patterns
3. basic public-site credibility checks after release

This is not the source of truth for gameplay usage or monetization-facing metrics.

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

## What Is Intentionally Deferred

The following are intentionally not part of the prerelease baseline:

### 1. Sentry

Deferred because:

1. the current stage does not yet justify another always-on vendor integration
2. uptime plus provider logs plus runtime analytics should be enough for the first adoption wave
3. it is better added later in one intentional pass than half-added now

Add it later only if real production debugging pain appears, and start with the platform app only.

### 2. PostHog

Deferred because:

1. Air Jam already has its own authoritative runtime analytics direction
2. PostHog would introduce a second product analytics model too early
3. the current product stage does not need advanced funnel tooling badly enough

### 3. Custom RUM Or Performance Stack

Deferred because:

1. Railway hosting does not force a separate RUM choice yet
2. the current public surface can live with simple website analytics plus manual performance verification
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
2. platform frontend regressions are not explainable from existing website analytics and provider logs
3. creator and product questions require richer hosted rollups than the current analytics surface provides
4. support load grows enough that structured error correlation becomes clearly worth it

## Current Recommendation

For prerelease and the first meaningful wave of public users, the right Air Jam observability stack is:

1. Better Stack uptime
2. Umami website analytics
3. Air Jam runtime analytics
4. provider logs

Anything more should wait for real evidence.
