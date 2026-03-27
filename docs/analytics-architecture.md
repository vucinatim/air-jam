# Air Jam Analytics Architecture

Last updated: 2026-03-27  
Status: implemented foundation

Related docs:

1. [Deployment and Monetization Strategy](./deployment-and-monetization-strategy.md)
2. [Framework Paradigm](./framework-paradigm.md)
3. [Implementation Plan](./implementation-plan.md)
4. [AI Studio Architecture](./ai-studio-architecture.md)
5. [Docs Index](./docs-index.md)

## Purpose

This document defines the intended analytics architecture for Air Jam.

It exists to make four things explicit:

1. what should count as authoritative usage truth
2. where analytics logic should live
3. how analytics should support monetization without distorting the framework
4. how Air Jam can stay ready for future creator-reward systems without promising unsafe payout logic too early

## Implementation Status

The analytics foundation described here is now implemented for the initial hosted platform path.

Implemented:

1. runtime usage publisher seam in the server
2. stable runtime analytics identity on room state
3. append-only raw runtime usage ledger
4. deterministic projection into normalized controller, game, and eligibility segments
5. derived game-session and daily aggregate metrics
6. platform analytics API and dashboard surfaces
7. operator rebuild path for ledger replay
8. first trust guards and analytics debug visibility

Still intentionally deferred:

1. creator/account-level rollups beyond per-game analytics
2. richer abuse-review and payout-readiness policy
3. selectable analytics windows and broader reporting UX
4. optional local analytics sinks for non-hosted dev projects

## Core Position

Air Jam analytics should be built around authoritative runtime facts, not browser beacons or dashboard-side counters.

The correct shape is:

1. the runtime server emits canonical usage events
2. the hosted control plane aggregates and derives analytics products
3. the dashboard reads derived metrics, not raw transport state
4. future billing, quotas, and creator rewards use the same derived metrics instead of inventing parallel accounting systems

This keeps analytics aligned with the broader product strategy:

1. open framework
2. first-class self-host path
3. hosted platform value in analytics, operational tooling, and trusted accounting

## Product Goal

The first analytics system should solve three problems well:

1. creators can understand real usage of their games
2. Air Jam can meter hosted usage cleanly for quotas and plan boundaries
3. the product remains technically ready for future creator-reward or payout models

The first version should not try to solve everything.

It should not start as:

1. a generic event firehose
2. a client-side product analytics system
3. a full payout engine
4. an abuse-blind playtime counter

## Architectural Boundary

Analytics is not another gameplay lane.

It is a server-observed accounting plane around the runtime system.

### Runtime Server Responsibilities

The runtime server should remain the source of truth for authoritative usage facts such as:

1. verified host bootstrap
2. room creation and room closure
3. room lifecycle transitions
4. active game identity
5. controller join and leave events
6. controller counts during game activity

The runtime server should not become a reporting product or payout engine.

Its analytics job is to emit canonical usage facts at the right semantic boundaries.

### Hosted Control Plane Responsibilities

The hosted control plane should own:

1. event ingestion and durable storage
2. derived metrics and rollups
3. dashboard analytics APIs
4. quota and entitlement evaluation
5. anomaly detection and abuse review
6. any future creator reward or payout calculations

This matches the broader product direction where analytics, billing, quotas, and moderation belong to the hosted authority plane.

### Dashboard Responsibilities

The platform dashboard should only read derived analytics views.

It should not:

1. infer playtime from UI state
2. count usage from client events directly
3. perform payout-grade calculations in request handlers

## Design Principles

### 1. Authoritative Over Approximate

If money, limits, or creator trust may depend on a metric later, it must originate from server-owned facts.

### 2. Semantic Events Over Transport Noise

Analytics should attach to domain events like:

1. room created
2. game became active
3. controller joined
4. controller left
5. room closed

It should not depend on low-level socket churn as the primary reporting contract.

### 3. Append-Only Raw Facts

Raw usage events should be immutable and append-only.

Corrections and rollups should happen in derived layers, not by mutating history.

### 4. Raw And Derived Data Must Stay Separate

Air Jam should distinguish between:

1. canonical event ledger
2. derived session records
3. aggregate reporting tables

This is necessary for trust, audits, reprocessing, and future monetization features.

### 5. Hosted Value, Open Boundary

The framework should remain open and self-hostable.

The paid hosted value should come from:

1. durable aggregation
2. analytics dashboards
3. abuse filtering
4. plan enforcement
5. creator-facing professional metrics

not from hiding the basic runtime model.

## Minimal Core Model

The cleanest analytics system is built from four primitives.

### 1. Runtime Usage Event

This is the canonical raw fact emitted by the runtime server.

Recommended shape:

1. event ID
2. event kind
3. occurred-at timestamp
4. runtime session ID
5. room ID
6. app ID when known
7. game ID when known
8. host verification mode when known
9. event payload with the minimal event-specific fields

Examples of event kinds:

1. `host_bootstrap_verified`
2. `room_created`
3. `room_registered`
4. `game_launch_started`
5. `game_became_active`
6. `game_returned_to_system`
7. `controller_joined`
8. `controller_left`
9. `room_closed`

### 2. Runtime Session

This is the durable accounting identity for one room lifecycle.

It should exist so analytics is not forced to treat `roomId` alone as the only identity.

Recommended shape:

1. runtime session ID
2. room ID
3. app ID
4. hosted mode or verification mode
5. started at
6. ended at
7. closing reason when known

### 3. Game Session

This is the derived record for one period of active gameplay within a runtime session.

Recommended shape:

1. game session ID
2. runtime session ID
3. game ID
4. game active started at
5. game active ended at
6. peak concurrent controllers
7. total controller-seconds
8. eligible playtime seconds

### 4. Aggregate Metrics

These are the dashboard-facing and billing-facing derived views.

Recommended slices:

1. per game per day
2. per app per day
3. per owner per day
4. per plan window for quotas

## Canonical Metric Definitions

Metrics should be intentionally narrow and easy to explain.

### Core Metrics

The first analytics product should focus on:

1. room starts
2. game starts
3. unique runtime sessions
4. unique controller joins
5. peak concurrent controllers
6. average game session length
7. total game-active time
8. eligible playtime

### Eligible Playtime

If Air Jam ever introduces creator rewards, eligible playtime should be defined from the start.

Recommended initial definition:

`eligible playtime = time during which the room focus is GAME and at least one verified controller is connected`

This is intentionally stricter than:

1. host tab open time
2. page loaded time
3. room exists time

That stricter definition is better for fairness and harder to abuse.

### Liveness Vs Eligibility

Air Jam must not treat transport liveness and accounting eligibility as the same thing.

These are different concepts:

1. `connected`: the server still considers the socket transport alive
2. `session active`: the runtime session is still valid and recoverable
3. `eligible playtime`: time that should count for analytics, quotas, or future rewards

This distinction matters because reconnect grace and heartbeat windows are useful for runtime UX, but they can distort accounting if used naively.

Examples:

1. a host may disconnect and still be within a short reconnect grace window
2. a controller may remain technically connected while no meaningful gameplay is happening
3. a room may still exist operationally even though eligible playtime should no longer accrue

Recommended accounting rule:

1. runtime liveness may use heartbeat and reconnect grace windows for resilience
2. analytics should pause or stop eligible accrual at the observed disconnect or inactivity boundary, not only at final room teardown
3. future payout-grade metrics should use stricter eligibility rules than raw socket lifetime

This is one of the most important guardrails in the system because it prevents accidental overcounting in both billing and creator reward flows.

### Controller-Seconds

Air Jam should also track controller-seconds separately.

This is useful because it captures group activity better than flat session length.

Example:

1. one player for 10 minutes = 600 controller-seconds
2. four players for 10 minutes = 2400 controller-seconds

This should remain a distinct metric from eligible playtime.

### User-Facing Analytics Depth

The initial product should expose simple creator-facing metrics first.

Examples:

1. total plays
2. total playtime
3. active days
4. peak players
5. recent trend

More advanced analytics can be a hosted paid-tier unlock later.

## Current Runtime Fit

Air Jam does not need a large rewrite to support this architecture.

The current runtime model already has the correct ownership boundary:

1. the server owns room lifecycle truth
2. the server knows active game identity
3. the server knows controller join and leave truth
4. the server already verifies host bootstrap and app identity

That means the architecture is already compatible with clean analytics.

## Required Structural Follow-Ups

Before analytics implementation begins, Air Jam should do a small structural pass so the system stays clean.

### 1. Add A Dedicated Usage Event Publisher

Socket handlers should not write analytics rows directly.

Instead:

1. runtime handlers trigger semantic usage events
2. one dedicated usage publisher normalizes them
3. persistence happens behind that boundary

This is the most important implementation rule in the whole system.

### 2. Add A Stable Runtime Analytics Identity

Room state should gain a stable analytics identity such as:

1. runtime session ID
2. room started-at timestamp
3. known hosted app identity when available

This prevents future accounting logic from depending on fragile reconstruction rules.

### 3. Keep Derivation Outside The Hot Path

The runtime server should emit facts quickly.

Heavy aggregation should happen:

1. asynchronously
2. in background jobs
3. in hosted analytics services when appropriate

This keeps runtime performance and analytics concerns decoupled.

## Projection Strategy

Once eligibility can pause and resume across reconnects, gaps, and recoveries, analytics derivation becomes an interval projection problem rather than a simple counter problem.

Air Jam should model this explicitly.

### Recommended Shape

The cleanest derivation flow is:

1. raw append-only usage ledger
2. normalized interval or segment records
3. aggregate metrics derived from those normalized intervals

This is better than trying to answer every dashboard question directly from raw events.

### Why This Matters

A raw ledger may contain patterns like:

1. controller joined
2. controller disconnected
3. controller reconnected
4. controller left

If reconnect grace and eligibility pauses are part of the product rules, then the analytics layer must intentionally exclude some gaps while preserving the audit trail.

That makes projection a first-class concern.

### Normalized Segment Examples

Recommended derived segment types include:

1. controller presence segments
2. game-active segments
3. eligible playtime segments

Example uses:

1. controller-seconds are computed from controller presence segments
2. total game-active time is computed from game-active segments
3. payout-grade or quota-grade playtime is computed from eligible playtime segments

### Incremental Projector

The default implementation should favor a small deterministic projector that:

1. consumes ordered raw events
2. updates normalized segment records
3. updates daily or session-level aggregates

This is usually easier to reason about than embedding all accounting semantics inside one large SQL query.

### SQL Recompute And Backfill

Postgres window functions are still useful.

Recommended uses:

1. backfilling derived data from the raw ledger
2. validating projector output
3. rebuilding aggregates after metric definition changes

Useful tools may include:

1. `LAG()`
2. `LEAD()`
3. partitioned ordering by runtime session, game session, or controller identity

These are implementation tools, not the primary product contract.

### API Read Rule

Dashboard and product APIs should read:

1. normalized segment tables
2. derived aggregate tables

They should not calculate interval math on demand from raw events inside request handlers.

That rule keeps reads fast, keeps accounting deterministic, and avoids duplicating metric logic across the product.

## Hosted Vs Self-Hosted Story

Analytics should respect the open product boundary.

### Self-Hosted Expectation

Self-hosted users should be able to:

1. run games without Air Jam hosted analytics
2. export or inspect usage events if they choose
3. attach their own analytics sink if desired

### Hosted Platform Value

Air Jam hosted value should come from:

1. durable aggregation
2. polished dashboards
3. long-term retention
4. quota-aware usage views
5. anomaly detection
6. creator-facing insights
7. future reward accounting

This keeps the business model aligned with operational value rather than framework lock-in.

## Payout And Reward Readiness

Air Jam should be payout-ready in architecture before it is payout-active in product.

That means:

1. define eligible playtime early
2. keep raw events auditable
3. keep derivation reproducible
4. separate creator metrics from reward calculations
5. treat abuse filtering as mandatory before real payouts

### Important Product Rule

Air Jam should not promise uncapped pay-per-minute creator payouts early.

If creator rewards are introduced, the safer rollout is:

1. analytics first
2. creator insights and analytics tiers second
3. capped reward pools, credits, or grants third
4. true payout systems only after abuse controls and unit economics are proven

## Abuse And Trust Requirements

Any future reward model based on usage must account for abuse from the start.

Required defenses eventually include:

1. reconnect deduplication
2. suspicious session clustering review
3. self-play filtering where appropriate
4. minimum thresholds for eligible sessions
5. anomaly detection on impossible or highly unlikely usage patterns
6. manual review paths for payout-impacting outliers

These do not all need to ship in version one of analytics.

They do need to be considered part of the architecture from day one.

## Initial Dashboard Slice

The first dashboard analytics view should stay simple.

Recommended first creator view:

1. total game starts
2. total eligible playtime
3. total controller joins
4. peak concurrent controllers
5. recent 7-day trend
6. last activity timestamp

This is enough to make the game dashboard meaningfully more useful without overbuilding the first release.

## Rollout Order

### Phase 1. Runtime Usage Event Contract

Define the semantic event contract and add a dedicated usage publisher seam inside the runtime server.

### Phase 2. Raw Event Ledger

Persist append-only usage events with stable runtime session identity.

### Phase 3. Derived Session And Daily Metrics

Create game session records and daily aggregate views for dashboard usage and quota reporting.

### Phase 4. Creator Analytics UI

Replace placeholder dashboard activity panels with real aggregate views.

### Phase 5. Hosted Entitlements And Advanced Analytics

Use the same derived metrics for:

1. analytics depth by plan
2. quota displays
3. room-hour reporting
4. future professional tooling

### Phase 6. Optional Creator Rewards

Only after trust and abuse controls are strong enough should Air Jam connect reward logic to the analytics foundation.

## Decision Rule

If future implementation options conflict, prefer the one that:

1. keeps runtime truth server-authoritative
2. avoids analytics logic inside gameplay or UI code
3. preserves the open framework and self-host story
4. keeps hosted analytics value in the control plane
5. stays compatible with future quotas, billing, and creator rewards without redesigning the foundation

## Closeout Rule

If Air Jam later introduces managed hosting, advanced analytics, or creator rewards, this document should be updated before implementation drifts into scattered counters or payout logic tied directly to UI behavior.
