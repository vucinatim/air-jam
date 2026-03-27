# Air Jam Analytics Implementation Plan

Last updated: 2026-03-27
Status: active

Related docs:

1. [Analytics Architecture](../analytics-architecture.md)
2. [Deployment and Monetization Strategy](../deployment-and-monetization-strategy.md)
3. [Framework Paradigm](../framework-paradigm.md)
4. [Implementation Plan](../implementation-plan.md)
5. [AI Studio Architecture](../ai-studio-architecture.md)
6. [Docs Index](../docs-index.md)

## Purpose

This document turns the analytics architecture into one explicit implementation plan.

The goal is:

1. build one clean analytics foundation
2. avoid scattering accounting logic across runtime handlers, SQL, and dashboard code
3. support creator analytics, quotas, and future reward systems from the same core model
4. keep the open framework and hosted control-plane boundary clean

This plan should not reopen the architecture unless implementation reveals a real contradiction.

## Direction Decision

Air Jam should implement analytics in this order:

1. narrow runtime refactor for analytics seams
2. authoritative runtime usage facts
3. append-only raw ledger
4. deterministic projection into normalized intervals
5. derived session and daily aggregates
6. dashboard analytics
7. hosted entitlement and advanced analytics features

This is the correct direction because:

1. server-owned runtime truth already exists
2. monetization depends on trusted accounting, not approximate beacons
3. projection complexity should be centralized once instead of re-solved in every feature
4. payout-readiness requires auditable foundations before reward logic exists

## What Is Already Good

Air Jam already has the important architecture baseline:

1. the server owns room lifecycle truth
2. the server knows active game identity
3. the server knows controller join and leave truth
4. host bootstrap and app identity verification already exist

This means Air Jam does not need an analytics rewrite of the runtime model.

The main implementation risk is style, not paradigm.

## Non-Negotiable Rules

These rules must hold throughout implementation.

### 1. No Direct Analytics Writes In Socket Handlers

Socket handlers may emit semantic usage facts.

They must not become the place where raw event rows, aggregates, or payout math are assembled inline.

### 2. No Dashboard Math From Raw Events

Dashboard APIs and UI routes must read derived analytics views only.

They must not perform interval stitching or eligibility math in request handlers.

### 3. No Browser Analytics As Authoritative Usage Truth

Browser/client signals may be useful later for product analytics, but not for payout-grade or billing-grade runtime usage truth.

### 4. Raw Events And Derived Data Stay Separate

The raw ledger remains append-only.

Derived intervals and aggregates are separate tables or projections.

### 5. Runtime Liveness Is Not Automatically Eligibility

Reconnect grace and heartbeat behavior may support runtime UX.

Eligibility accrual must follow the stricter accounting rules defined in the analytics architecture.

## Deliverables

The first implementation arc should produce these concrete outputs:

1. usage event publisher seam in the server
2. runtime analytics identity in room state
3. canonical runtime usage event contract
4. raw event ledger persistence
5. normalized interval projection
6. game-session and daily aggregate tables
7. platform analytics API surface
8. first dashboard analytics view
9. validation and recompute path

## Phase 0. Narrow Runtime Refactor

### Goal

Create the minimal structural seams that let analytics be added cleanly.

### Why this phase comes first

Air Jam does not need a large runtime rewrite before analytics.

It does need one narrow refactor so the implementation does not devolve into:

1. analytics writes spread through socket handlers
2. fragile room identity reconstruction later
3. duplicated runtime-to-analytics translation logic

This is the key cleanliness pass for the whole initiative.

### Required outcome

Before ledger, projector, or dashboard work begins, the runtime server should gain:

1. a dedicated usage publisher boundary
2. stable runtime analytics identity in room state
3. a clear rule that handlers emit semantic facts but do not perform analytics persistence or aggregation inline

### Concrete refactor scope

The initial refactor should stay intentionally small:

1. define the publisher interface and insertion points
2. add runtime session identity fields to room state
3. thread app identity and host verification mode into the room analytics shape when known
4. avoid schema or dashboard work in this phase unless required by the publisher contract

### Success criteria

This phase is complete when:

1. the runtime server has one explicit analytics seam
2. room state carries the minimal analytics identity needed downstream
3. future phases can attach storage and projection logic without reopening runtime architecture

## Phase 1. Runtime Usage Event Contract

### Goal

Define the canonical semantic events that analytics will trust.

### Required outcome

Air Jam should define one usage event vocabulary with event kinds such as:

1. `host_bootstrap_verified`
2. `room_created`
3. `room_registered`
4. `game_launch_started`
5. `game_became_active`
6. `game_returned_to_system`
7. `controller_joined`
8. `controller_disconnected`
9. `controller_reconnected`
10. `controller_left`
11. `room_closed`

### Implementation notes

1. event shape should be stable and explicit
2. timestamps must be server-observed
3. event payloads should stay minimal and semantic
4. usage events should live behind a dedicated server boundary rather than inside the dashboard app

## Phase 2. Usage Publisher Seam

### Goal

Create one clean server boundary that emits usage facts without polluting socket handlers.

### Required outcome

Add a dedicated usage publisher module that:

1. receives semantic usage events from runtime boundaries
2. normalizes them into the canonical event shape
3. hands them off to persistence or a queue boundary

### Required refactor

Before or during this phase, add a stable analytics identity to runtime room state:

1. runtime session ID
2. room started-at timestamp
3. app ID when known
4. host verification mode when known

### Implementation rule

The usage publisher should be the only place that knows how to translate runtime semantics into analytics event rows.

## Phase 3. Raw Event Ledger

### Goal

Persist append-only authoritative usage facts.

### Required outcome

Introduce raw analytics storage for:

1. usage events
2. runtime session metadata

### Storage rules

1. raw events are append-only
2. derived corrections happen downstream
3. raw storage must preserve enough context for reprocessing
4. ordering should be stable within one runtime session

### Minimum captured fields

1. event ID
2. event kind
3. occurred-at
4. runtime session ID
5. room ID
6. app ID when known
7. game ID when known
8. payload JSON for event-specific details

## Phase 4. Projection Layer

### Goal

Turn raw usage facts into normalized intervals and session facts.

### Required outcome

Implement a deterministic projector that consumes ordered raw events and writes:

1. controller presence segments
2. game-active segments
3. eligible playtime segments
4. game session records

### Why this phase exists

Once disconnects, reconnects, and eligibility pauses exist, analytics becomes an interval projection problem.

That complexity should be solved once in a dedicated projector, not rediscovered in every query.

### Recommended implementation model

Prefer a small app-level projector first:

1. deterministic
2. ordered by runtime session and event time
3. easy to test
4. easy to backfill and reason about

### Recompute support

Postgres window functions may support:

1. backfills
2. validation
3. full recompute after metric definition changes

But large ad hoc SQL should not become the only place where analytics semantics live.

## Phase 5. Aggregate Metrics

### Goal

Produce dashboard-grade and quota-grade aggregates from normalized intervals.

### Required outcome

Add derived aggregate views or tables for:

1. per game per day
2. per app per day
3. per owner per day
4. plan-window usage summaries

### First aggregate metrics

1. room starts
2. game starts
3. unique runtime sessions
4. unique controller joins
5. peak concurrent controllers
6. total game-active time
7. total controller-seconds
8. eligible playtime seconds
9. last activity timestamp

## Phase 6. Platform Analytics API

### Goal

Expose one clean read surface for platform analytics.

### Required outcome

Add protected analytics read endpoints that:

1. are owner-scoped
2. read only derived analytics tables
3. return simple creator-facing views first

### API rule

No endpoint in this phase may derive interval math from raw events on demand.

## Phase 7. Dashboard Analytics UI

### Goal

Replace placeholder platform analytics panels with real metrics.

### Required outcome

The first dashboard game view should show:

1. total game starts
2. total eligible playtime
3. total controller joins
4. peak concurrent controllers
5. recent trend
6. last activity

### Design rule

The first UI should stay intentionally simple.

Advanced analytics depth can be layered later without changing the accounting model.

## Phase 8. Hardening And Trust

### Goal

Make the analytics system safe for quotas and future monetization.

### Required outcome

Add validation around:

1. disconnect and reconnect edge handling
2. runtime liveness versus eligibility boundaries
3. room close semantics
4. duplicate or replayed event protection
5. projector idempotency
6. recompute correctness

### Operational tooling

Hardening should leave behind a real operator path, not just test-only recompute logic.

Current rebuild entrypoint:

1. `pnpm analytics:rebuild -- --session=<runtimeSessionId>`
2. `pnpm analytics:rebuild -- --all`

### Abuse-readiness direction

Do not implement full creator payouts in this phase.

Do ensure the system is compatible with future abuse checks such as:

1. reconnect deduplication
2. suspicious clustering review
3. self-play filtering
4. minimum eligible thresholds
5. anomaly detection

## Testing Strategy

Analytics implementation should ship with explicit tests at each layer.

### Server event contract tests

Verify that major runtime lifecycle edges emit the correct usage events.

### Projection tests

Use deterministic event sequences to verify interval outcomes for cases like:

1. clean join and leave
2. disconnect and reconnect within grace
3. room close after host disconnect
4. game switch and return to system
5. multiple controllers overlapping

### Aggregate tests

Verify that normalized segments roll up into correct session and daily metrics.

### Recompute tests

Verify that replaying the raw ledger reproduces the same derived outputs.

## Sequence Recommendation

This is the recommended implementation order:

1. define event vocabulary and usage publisher interface
2. add runtime analytics identity to room state
3. persist raw event ledger
4. build projector and normalized interval tables
5. build aggregate tables
6. expose analytics API
7. wire dashboard UI
8. add hardening, recompute, and validation paths

This order matters.

If Air Jam skips the publisher or projection seam and starts with dashboard reads, the system will accumulate the wrong kind of complexity.

## What To Avoid

Do not:

1. add analytics writes directly in many handlers
2. calculate playtime from browser beacons
3. use room existence as playtime
4. use raw socket lifetime as payout-grade truth
5. push interval math into dashboard queries
6. couple analytics logic to product-tier checks too early
7. implement real creator payout logic before the accounting layer is trusted

## Open Questions To Resolve During Implementation

These are implementation questions, not architecture blockers:

1. should the raw ledger live in the current platform Postgres first or be introduced behind a separate hosted analytics service immediately
2. should the projector run inline after insert for the first version or as a background job loop
3. what retention policy should raw events and normalized segments use in the first hosted version
4. what minimal analytics slice is enough to replace the current dashboard placeholder without overbuilding

## Completion Criteria

This plan is complete when all of these are true:

1. runtime emits canonical usage events through one publisher seam
2. raw events are durably persisted
3. normalized intervals exist for controller presence, game-active time, and eligible playtime
4. aggregate analytics can be queried without recomputing interval math on demand
5. the platform dashboard shows real analytics for a game owner
6. recompute and correctness tests exist for disconnect and reconnect edge cases
7. the system is structurally ready for quotas and future creator rewards without another architecture pass

## Closeout Rule

When the first production-worthy analytics slice ships:

1. move completed implementation detail out of this plan
2. keep the long-term architecture in `docs/analytics-architecture.md`
3. archive this plan when it is no longer the active tracker
