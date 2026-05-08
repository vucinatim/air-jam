# Post-V1 Topology Roadmap

Last updated: 2026-05-08  
Status: post-v1 architecture roadmap

Related docs:

1. [Current State](../current-state.md)
2. [Work Ledger](../work-ledger.md)
3. [Vision](../vision.md)
4. [Framework Paradigm](../framework-paradigm.md)
5. [Deployment And Monetization Strategy](./deployment-and-monetization-strategy.md)
6. [Deployment Topology](./deployment-topology.md)

## Purpose

This roadmap defines the intended post-v1 application-topology evolution for
Air Jam.

It exists to answer three questions cleanly:

1. how Arcade should become a more independent product surface after Railway consolidation
2. how the long-term API and auth boundary should be extracted without turning the current platform into an accidental forever-monolith
3. how to sequence those changes without reopening deployment churn during launch closeout

This is not the active release plan.

The active release plan remains:

1. [plans/v1-release-plan.md](../plans/v1-release-plan.md)

This roadmap becomes current only after the v1 release path is closed or when a
release-blocking deployment reset forces it forward.

## Core Decision

The repo should keep the now-simpler Railway-first deployment model intact while separating product boundaries in later phases.

The intended direction is:

1. keep the Railway consolidation stable
2. only then split public Arcade into its own app boundary
3. only after that extract the platform/business API and auth boundary into a
   dedicated service

Do not collapse these into one migration.

## Why This Roadmap Exists

The Railway consolidation solved the biggest operational pain, but it did not erase the next product-boundary questions.

The Air Jam platform is not just a static marketing site.

It already owns:

1. docs and search surfaces
2. dashboard/account flows
3. release records and media flows
4. hosted Arcade bootstrap
5. runtime-aware client behavior
6. auth-backed creator flows

So the right answer is not "make deployment even more custom."

The right answer is to simplify the provider topology first, then refine the
application topology second.

## Block 1 - Railway Consolidation

### Goal

Move the current platform application from Vercel onto Railway so the main Air Jam runtime surfaces live under one provider and one environment model.

### Why First

This was the highest-leverage simplification because it removed the largest source of operational drift:

1. Vercel previews vs Railway previews
2. Vercel env scopes vs Railway env scopes
3. Vercel domain aliasing vs Railway service domains
4. cross-provider production verification

### Target Outcome

Current result:

1. platform runs on Railway as a normal Next.js service
2. server and browser worker still run on Railway
3. previews are Railway-native
4. production deploys and preview deploys are described by one provider story
5. custom preview alias orchestration is gone from the active surface

### Scope

In scope:

1. deploy the existing Next.js platform on Railway
2. normalize platform env/runtime assumptions for Railway hosting
3. adopt Railway-native preview environments as the canonical preview model
4. simplify production and preview verification around one provider
5. clean up Vercel-specific runtime assumptions that no longer make sense

Out of scope:

1. splitting Arcade into a separate app
2. extracting the platform/business API
3. removing tRPC
4. reworking auth architecture
5. broad UI or product refactors unrelated to deployment simplification

### Key Technical Work

1. Make the platform deploy cleanly as a Railway-hosted Next.js service.
   This likely means:
   - standalone build output
   - stable start command
   - explicit public domain wiring
2. Remove Vercel-specific assumptions from the platform host layer.
   Examples:
   - `VERCEL_URL`-centric logic
   - Vercel hostname redirects that stop making sense
   - Vercel-only operational assumptions in deploy/bootstrap docs
3. Reframe preview environments around Railway-native behavior and remove the
   repo-owned preview lifecycle from the active surface.
4. Define one boring production verification path:
   - platform URL healthy
   - Arcade URL healthy
   - host grant route healthy
   - backend reachable
5. Rewrite deployment docs and runbooks so they describe one provider model.

### Preview Model After Block 1

The intended preview model is:

1. Railway PR environment spins up when a PR opens
2. platform, server, and worker are all part of that provider-native preview
3. Railway-provided service domains are the default preview URLs
4. custom vanity preview hostnames are optional, not foundational

### Risks

1. Railway-hosted Next.js may need a few host-specific adjustments:
   - standalone output
   - caching behavior
   - start/build conventions
2. if we later scale the platform horizontally, Next.js self-hosting concerns
   become more important:
   - cache coordination
   - consistent encryption key
   - deployment skew handling

These are real concerns, but they are still simpler than the current
cross-provider drift.

### Done Criteria

Block 1 is considered complete when:

1. the platform is no longer deployed on Vercel
2. production and preview platform deploys both run through Railway
3. preview creation no longer depends on the removed custom preview control plane
4. provider verification is boring enough that deploys stop requiring rescue loops

## Block 2 - Arcade Isolation

### Goal

Turn Arcade into its own application surface instead of keeping it embedded
inside the platform app forever.

### Why Second

Arcade isolation is a product-boundary decision, not just a deployment fix.

Doing it before Railway consolidation would mix:

1. provider migration risk
2. runtime boundary refactor risk
3. public-surface product changes

That is unnecessary churn.

### Target Outcome

After Block 2:

1. `platform` remains the creator/docs/account/release application
2. `arcade` becomes its own public runtime/launcher/player application
3. the platform and Arcade are deployed independently
4. Arcade can evolve toward richer app-shell distribution later

### Scope

In scope:

1. define the Arcade app boundary
2. isolate public game browsing and runtime launch concerns from platform
3. move Arcade-specific runtime shell logic out of the platform app
4. decide the best runtime for the new Arcade app

Out of scope:

1. extracting business API/auth into a separate service
2. changing the server/browser-worker architecture
3. rewriting release storage or asset contracts without a clear need

### Architecture Direction

The intended split is:

1. Platform
   - docs
   - dashboard
   - account/auth UI
   - game records
   - release/media management
   - launch/admin/operator surfaces
2. Arcade
   - public game browser
   - runtime launcher/player shell
   - join and host UX
   - future packageable consumer surface

### Vite Question

Vite is a serious candidate for the future Arcade app because Arcade is already
mostly a client/runtime surface.

But Block 2 should not assume Vite before the actual extraction boundary is
mapped.

The decision should be:

1. if the isolated Arcade app mostly behaves like a client application shell,
   use Vite
2. if it still depends heavily on Next-hosted server behavior, keep it in
   Next.js a bit longer

Do not choose Vite for ideology.
Choose it only if it simplifies the actual boundary.

### Why This Split Is Attractive

Arcade has a different product character from platform:

1. it is more runtime-heavy
2. it is more client-shell-like
3. it is a better candidate for future app packaging or launcher distribution
4. it should not stay forever coupled to docs and dashboard concerns

### Risks

1. Arcade currently depends on platform-side data/loading and session config
2. release/public asset assumptions may still be too platform-coupled
3. splitting too early could create accidental duplication instead of a clean
   boundary

### Done Criteria

Block 2 is done when:

1. Arcade is its own app boundary
2. platform can evolve without dragging the Arcade runtime shell along
3. Arcade can later be packaged or distributed more independently if desired

## Block 3 - API And Auth Service Extraction

### Goal

Extract the platform/business API and auth boundary into a dedicated service so
Platform and Arcade both become explicit clients of a shared backend contract.

### Why Third

This is the biggest application-boundary shift in the roadmap.

It should happen only after:

1. provider topology is simplified
2. Arcade is no longer entangled inside the platform app

Otherwise we would be trying to stabilize deployment, separate product
surfaces, and redesign auth/API ownership at the same time.

### Target Outcome

After Block 3:

1. API becomes its own service runtime
2. auth becomes API-owned
3. platform and Arcade both consume stable backend contracts
4. the repo no longer depends on a Next-embedded business API as the permanent
   architecture

### Scope

In scope:

1. define the API service boundary
2. move auth ownership to that service
3. move platform business routes to that service
4. define stable browser/client contracts for platform and Arcade

Out of scope:

1. changing the realtime gameplay server role unless the boundary truly needs it
2. broad SDK/runtime redesign not caused by the extraction itself

### tRPC Decision

Do not remove tRPC during Block 1.
Do not remove tRPC during Block 2 unless it blocks the Arcade split.

Reevaluate it in Block 3.

Current recommendation:

1. keep tRPC while the platform remains a monolith
2. once API becomes its own service, prefer normal HTTP route contracts as the
   long-term primary boundary

Why:

1. clearer cross-app boundary
2. easier for Arcade, platform, CLI, agents, and future packaged apps
3. less React/Next-specific coupling in the backend contract

### Auth Direction

The intended auth model after extraction is:

1. auth is backend-owned
2. browser apps use shared client/session helpers
3. shared auth package owns common contracts and bridging logic
4. platform is no longer the permanent place where auth "lives"

This is closer to the stronger split used in `yu-gi-ai`:

1. dedicated API runtime
2. separate browser app runtime
3. shared auth package
4. cleaner service-boundary ownership

### Risks

1. extracting too early would add complexity before the product boundaries are
   stable
2. moving off tRPC too soon could create churn without enough payoff
3. auth/cookie/origin handling becomes more important once apps and API are
   clearly separate

### Done Criteria

Block 3 is done when:

1. API is its own service
2. auth is API-owned
3. platform and Arcade are thin clients over explicit backend contracts
4. tRPC is either intentionally retained for a narrow reason or replaced by a
   cleaner service-facing HTTP boundary

## Non-Goals

This roadmap is not permission to:

1. do all three blocks in one migration
2. reopen broad prerelease churn before v1 closes
3. remove tRPC immediately just because a separate API sounds cleaner
4. split Arcade before the provider topology is simplified
5. over-design a multi-app architecture before the current deployment story is
   stabilized

## Recommended Order

1. finish v1 release closeout
2. execute Block 1 Railway consolidation
3. validate that deploys/previews/domains are genuinely calmer
4. execute Block 2 Arcade isolation
5. execute Block 3 API/auth extraction

## Canonical Summary

The intended post-v1 shape is:

1. first simplify provider topology
2. then simplify public app boundaries
3. then simplify backend ownership

That ordering is the main architectural decision.
