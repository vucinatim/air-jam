# Air Jam Framework Paradigm

Last updated: 2026-03-29  
Status: active

## Purpose

This document defines the current Air Jam paradigm across the whole ecosystem:

1. the framework runtime model
2. the first-party platform model
3. the hosted control-plane direction
4. the AI-native creation direction

It should answer four questions clearly:

1. what Air Jam is
2. what makes it different
3. what keeps it strong as it grows
4. where it is intentionally going next

## Air Jam In One Sentence

Air Jam is a phone-as-controller multiplayer framework with a hosted platform around it and a future AI-native creation layer on top of it.

The framework stays open and self-hostable.
The hosted product adds trusted operational value around it.

## Product Identity

Air Jam is not just one thing.

It is a deliberately layered system:

### 1. Framework

The reusable core:

1. SDK
2. runtime server
3. multiplayer session model
4. replicated state/input/signal primitives
5. scaffolds and templates

### 2. First-Party Platform

The hosted user-facing layer:

1. app identity and dashboard
2. docs and public delivery
3. Arcade browser and publishing
4. analytics surfaces
5. future deploy and version-management UX

### 3. Hosted Control Plane

The trusted product authority:

1. authentication
2. publish and deployment authority
3. analytics aggregation
4. quotas, billing, and moderation
5. future artifact and version lifecycle

### 4. Future Studio

The AI-native creation layer:

1. local-first editing and preview
2. Air Jam-aware agents
3. snapshot-driven project lifecycle
4. trusted hosted publish path

These layers should share one coherent model, not drift into separate products with separate architecture rules.

## What Makes Air Jam Unique

Air Jam’s differentiators are not generic “real-time app” features.

The real uniqueness is the combination of:

1. phone-as-controller being the default interaction model, not a side feature
2. one framework model for standalone games and Arcade-hosted games
3. deterministic replayable shell state across host, controller, and embedded runtimes
4. open self-hostable framework plus a hosted product layer, instead of forced lock-in
5. AI-native project structure built around strong contracts instead of prompt chaos

That combination is the core product identity.

## The Core Runtime Model

Air Jam has three lanes.
They must stay separate.

### 1. Input Lane

Use for high-frequency transient control input.

Examples:

1. movement vectors
2. button presses
3. steering / throttle / aim

Rules:

1. controllers write input
2. hosts read input
3. per-frame gameplay input does not go through replicated state

### 2. Replicated State Lane

Use for authoritative shared application state.

Examples:

1. teams
2. scores
3. match phase
4. Arcade shell surface state
5. any fact that must replay correctly after join or reconnect

Rules:

1. the host owns authoritative state
2. every fact has one owner only
3. replayable snapshot beats transient pulse
4. `createAirJamStore` is the canonical primitive here

### 3. Signal / Command Lane

Use for explicit coarse intent and UX/system effects.

Examples:

1. haptics
2. toasts
3. exit game
4. show QR
5. open menu
6. play one-shot audio cues

Rules:

1. commands stay explicit
2. signals do not own gameplay truth
3. avoid hidden toggle-heavy platform behavior when a direct command is clearer

## Ownership Model

The most important Air Jam rule is still:

1. one owner per fact

### Host Owns

1. authoritative replicated state
2. gameplay decisions
3. shell state for its app domain
4. controller presentation hints that belong to host UX

### Controller Owns

1. local input publishing
2. local-only shell affordances
3. rendering of whatever the authoritative snapshot says is active

Controllers do not own room or gameplay truth.

### Server Owns

Only hard runtime invariants:

1. room membership
2. controller identity
3. host authorization
4. child-host attach authorization
5. routing and focus
6. reconnect continuity
7. capability and epoch validation

The server should not become the owner of app-level UI state.

### Platform Owns

Hosted product concerns:

1. app identities
2. publish and discovery surfaces
3. deploy/version metadata
4. analytics aggregation and dashboard APIs
5. future billing/quota/moderation policy

### Studio Will Own

1. project snapshots
2. local-first creation loop
3. agent orchestration
4. authoritative publish handoff

Studio should not invent a separate runtime model from the framework.

## Arcade Is Not A Separate Paradigm

Arcade is an Air Jam app around another Air Jam app.

That means there are two legitimate domains:

1. the Arcade shell domain
2. the active embedded game domain

They may both use Air Jam primitives, but they must not own the same facts.

### Arcade Shell Owns

1. browser vs game surface
2. active game metadata
3. controller-facing surface metadata
4. platform overlay state
5. platform-level pause/exit/menu intent

### Embedded Game Owns

1. lobby/readiness
2. teams
3. scores
4. match phase
5. gameplay-only controller UX

### The Bridge Owns

Only transport adaptation:

1. iframe transport forwarding
2. capability and epoch validation
3. stale-runtime rejection

The bridge is plumbing, not a second architecture.

## Deterministic Shell Sync

Air Jam should always choose replayable shell truth over transient UI pulses.

That is why Arcade surface state is authoritative and replayable.

Why this matters:

1. reconnect works from snapshot alone
2. stale embedded runtimes can be invalidated deterministically
3. host and controller stay aligned from the same state
4. product features do not need ad hoc reconnect exceptions everywhere

## Open Framework, Hosted Value

Air Jam should not monetize by crippling the framework.

The framework should remain:

1. adoptable
2. self-hostable
3. honest about its boundaries

The hosted value should come from:

1. app identity management
2. official realtime backend and control-plane policy
3. analytics and dashboard surfaces
4. deploy/version workflow
5. arcade publishing and discovery
6. future AI-native Studio and automation flows

This is important because it keeps the product aligned with real user value instead of artificial lock-in.

## Analytics And Accounting Direction

Analytics is not another gameplay lane.

It is a server-observed accounting plane around the runtime.

The correct model is:

1. runtime server emits canonical usage facts
2. hosted control plane stores the append-only raw ledger
3. derived metrics power dashboards, quotas, and future monetization
4. billing/reward logic should never be rebuilt from browser-side approximations

This keeps analytics trustworthy and compatible with future platform economics.

## Deployment Direction

Air Jam should converge different deployment inputs into one product concept:

1. `Game Version`

Inputs may differ:

1. external URL
2. Git-connected deploy
3. artifact upload
4. future Studio-published artifact

But the hosted system should think in one canonical release model.

That is how deployment, analytics, monetization, and Studio stay aligned instead of fragmenting into separate products.

## AI-Native Direction

Air Jam should be fast to build with because it is constrained and well-structured, not because it is vague.

The correct AI-native model is:

1. strong repo contract
2. one active work ledger
3. bounded plans
4. local-first docs and skills
5. testable modular starter architecture
6. explicit workflow for humans and agents

This matters at two levels:

1. generated game repos
2. the Air Jam monorepo itself

The system should reward disciplined growth, not chat-history-driven improvisation.

## How To Keep Air Jam Strong As It Grows

These rules matter more than any one feature.

### 1. Keep The Lanes Separate

Do not blur input, replicated state, and signal/command paths for convenience.

### 2. Keep One Owner Per Fact

If multiple layers own the same truth, drift and reconnect bugs follow.

### 3. Prefer Snapshot Over Pulse

If a fact matters after reconnect, it belongs in replayable state.

### 4. Keep The Server Narrow

The server should enforce runtime invariants, not absorb product UI ownership.

### 5. Keep The Bridge Dumb

Transport plumbing should not become product architecture.

### 6. Keep The Framework Headless-First

Framework primitives should stay reusable and composable.
First-party UI and platform affordances should layer on top cleanly.

### 7. Keep The Product Layers Honest

Hosted value should live in hosted services, not in framework restrictions.

### 8. Keep AI-Native Contracts Sharp

Templates, plans, skills, and docs should reduce ambiguity, not add another pile of drifting instructions.

### 9. Keep Growth Tested At Real Boundaries

Air Jam should keep proving itself through:

1. scaffold validation
2. real game migrations
3. browser-level happy-path proof
4. package tarball proof

### 10. Archive Aggressively

Completed transitions should leave the active docs surface.
A clean active surface is part of the architecture.

## Where Air Jam Is Going

The intended direction is:

1. stronger release proof on real games
2. cleaner managed deployment around `Game Version`
3. richer hosted analytics and creator-facing metrics
4. optional managed platform value without harming self-hosting
5. a local-first Air Jam Studio with trusted hosted publish
6. more AI-native workflows, but always through structure and bounded contracts

Air Jam should grow into a full ecosystem without losing its core shape:

1. open framework
2. strong runtime model
3. hosted product value
4. local-first creative tooling

## Acceptance Criteria

This paradigm is working when all of these are true:

1. standalone games and Arcade-hosted games still feel like one framework model
2. host, controller, and embedded runtimes stay aligned from replayable state
3. the server remains narrow and authoritative only where it should be
4. platform features layer on top of framework primitives instead of forking them
5. self-hosting remains real even as managed deployment grows
6. analytics, deployment, and monetization share one trusted hosted control-plane model
7. AI-native templates and monorepo workflows stay structured and testable
8. Air Jam can ship new product layers without needing another paradigm reset
