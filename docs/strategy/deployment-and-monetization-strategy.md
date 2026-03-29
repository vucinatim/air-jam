# Air Jam Deployment and Monetization Strategy

Last updated: 2026-03-26  
Status: active strategy

Related docs:

1. [Framework Paradigm](./framework-paradigm.md)
2. [Auth Capability Plan](../plans/auth-capability-plan.md)
4. [AI Studio Architecture](../systems/ai-studio-architecture.md)
5. [Docs Index](../docs-index.md)

## Purpose

This document defines the intended long-term product strategy for:

1. deployment
2. monetization
3. hosted platform scope
4. licensing direction

It exists so Air Jam does not drift into an accidental business model.

The goal is a product that:

1. stays friendly to hobby developers
2. can pay for its own infrastructure
3. can grow into a professional hosted platform
4. remains compatible with a future Air Jam-native AI game creation product

## Core Position

Air Jam should not monetize by restricting the framework itself.

The framework should remain easy to adopt, easy to self-host, and honest about its boundaries.

The monetizable layer is the hosted service around the framework:

1. official realtime backend
2. dashboard and app identity management
3. arcade publishing and discovery
4. optional managed deployment
5. future automation and AI-native creation flows

This keeps the product aligned with the actual value being provided.

## Product Principles

### 1. Self-Hosting Must Stay First-Class

Developers must always be able to:

1. build a game with `@air-jam/sdk`
2. deploy it on their own infrastructure
3. connect it to Air Jam using the platform and app identity model

Air Jam should never force managed deployment as the only path.

### 2. Managed Hosting Should Be Optional Convenience

Air Jam may host and deploy games, but that should be an optional product lane.

The paid value is:

1. convenience
2. speed
3. better operational defaults
4. versioning and publishing workflow
5. platform-native deploy UX

not artificial lock-in.

### 3. Free Tier Must Be Real

The free tier should be generous enough for:

1. hobby developers
2. prototypes
3. student projects
4. small friend-group games
5. game jams

If the free tier feels fake, the product will feel extractive.

### 4. Pricing Must Follow User Value, Not Infra Internals

Users should understand what they are paying for.

Avoid pricing language like:

1. websocket messages
2. replication packets
3. CDN egress tables
4. socket connection minutes

Prefer user-facing value units like:

1. hosted games
2. published games
3. room-hours
4. concurrent rooms
5. deploy workflows
6. analytics
7. team access

### 5. The Future AI Studio Must Fit The Same Model

Air Jam is expected to grow into a game creation product with specialized agents operating in a sandboxed environment.

That future product should not require a separate deployment architecture.

The same deployment system should support:

1. external self-hosted games
2. Git-connected game repos
3. uploaded build artifacts
4. AI-generated build artifacts through an API

## Product Shape

Air Jam should have two core lanes and one future expansion lane.

### Lane 1. Framework + Platform

This is the current core product:

1. SDK
2. server
3. app identity
4. dashboard
5. arcade publishing

This lane drives adoption.

### Lane 2. Managed Deployment

This is the monetization-friendly convenience layer:

1. hosted static deploys
2. deploy versioning
3. custom domains
4. rollback
5. Git-connected deploys

This lane drives recurring revenue.

### Lane 3. AI-Native Air Jam Studio

This is the longer-term product extension:

1. browser-based creation environment
2. specialized Air Jam-aware agents
3. sandboxed build environment
4. one-click publish into Air Jam deployment targets

This lane should reuse the same deployment primitives rather than inventing a separate publishing stack.

## Deployment Strategy

Air Jam should support three deployment inputs that converge into one canonical release model.

### Canonical Product Concept: `Game Version`

Regardless of where a build comes from, the platform should think in terms of a versioned deployable release.

Recommended conceptual shape:

1. game
2. deployment source
3. version
4. status
5. live URL
6. rollback target

The source may differ, but the published object should feel the same.

### Deployment Input A. External URL

This remains the default and most open path.

Flow:

1. developer deploys on Vercel / Netlify / Cloudflare / custom hosting
2. developer enters the URL in Air Jam
3. Air Jam uses that URL for play and arcade publishing

Why this must stay:

1. lowest lock-in
2. easiest adoption
3. lowest Air Jam infra burden
4. consistent with the framework being real open infrastructure

### Deployment Input B. Git-Connected Deploy

This is the best DX for most human developers.

Flow:

1. developer links a GitHub repository
2. Air Jam detects deployable game config
3. Air Jam builds on configured branch pushes
4. Air Jam creates versioned deploys automatically

This should feel like a specialized Air Jam deploy product, not a full general-purpose app platform.

### Deployment Input C. Artifact Deploy

This is the best DX for automation, agents, and generated apps.

Flow:

1. build happens elsewhere
2. Air Jam receives a built artifact
3. Air Jam stores and serves the static output
4. Air Jam creates a versioned deploy

This has two major uses:

1. advanced users uploading a known-good build directly
2. future Air Jam Studio agents publishing from a sandbox

## Why Air Jam Should Not Try To Become General-Purpose Vercel

Air Jam should avoid becoming an all-purpose hosting product.

That would create complexity in:

1. build systems
2. frameworks
3. server-side rendering
4. general cloud operations
5. support burden

Air Jam should instead be a focused deploy product for Air Jam-compatible static games.

That keeps the scope clean:

1. static output only
2. game-focused metadata
3. platform-native app identity
4. arcade publishing integration
5. future AI artifact publishing

This is a much cleaner and more defensible product boundary.

## Recommended Rollout Order

### Phase 1. External URL First

Keep improving the current model:

1. self-hosted game URL in dashboard
2. app ID issuance
3. publish to arcade

This remains the lowest-friction open path.

### Phase 2. Artifact Deploy

Add the simplest managed deployment path first.

Why first:

1. smallest implementation surface
2. useful for advanced users immediately
3. necessary foundation for future AI studio publishing
4. avoids needing Git provider integration as the first step

### Phase 3. Git-Connected Deploy

Add GitHub-connected deploys when the core version/deploy model is stable.

Why after artifacts:

1. Git integration is productively valuable but operationally heavier
2. it should reuse the same version/deploy pipeline
3. it is easier once artifact deployment already exists internally

### Phase 4. AI Studio Publish API

Once Air Jam Studio exists, it should publish through the same deploy API as artifact deploys.

This avoids a split system.

## Monetization Strategy

### What Air Jam Should Charge For

Air Jam should charge for:

1. hosted backend usage at scale
2. managed deployment convenience
3. publishing and operational workflow
4. analytics and professional tooling
5. team and event features

Air Jam should not primarily charge for:

1. using the SDK
2. basic experimentation
3. having small hobby games
4. self-hosting

### Friendly Revenue Model

The emotional contract should be:

1. build for free
2. test for free
3. self-host if you want
4. pay when Air Jam is saving you time or carrying real usage

That is the right level of friendliness for this product.

## Pricing Direction

These prices are a strategic starting point, not a locked public commitment.

### Free

Recommended position:

1. `EUR 0`
2. support self-hosted games
3. include official backend access with modest limits
4. include a small managed deployment allowance once managed hosting exists
5. include at least one publishable public game

Intended user:

1. hobby developer
2. student
3. weekend experiment
4. game jam team

### Creator

Recommended position:

1. around `EUR 8 / month`
2. annual option with discount

Value unlocks:

1. more hosted games
2. managed deployment
3. custom domain
4. deploy history
5. rollback
6. higher backend room-hours / concurrency
7. better analytics
8. private or unlisted releases

Intended user:

1. serious indie developer
2. small agency
3. repeat creator

### Pro Studio

Recommended position:

1. around `EUR 24 / month`
2. annual option with discount

Value unlocks:

1. more projects and hosted games
2. team access
3. higher backend and hosting limits
4. advanced analytics
5. stronger auth and capability options
6. API access for automation
7. priority support

Intended user:

1. studio
2. agency
3. event-heavy creator
4. internal team using Air Jam professionally

### Event Pass

Recommended position:

1. short-duration paid boost
2. one-off or temporary plan
3. likely starting point around `EUR 19` for a short event window and `EUR 39` for a longer temporary window

Why this matters:

1. many Air Jam use cases are event-shaped
2. some users do not want another subscription
3. this is a natural fit for conferences, bars, classrooms, installations, and agencies

This may become one of the most user-friendly monetization paths in the product.

## Initial Package Sketch

This is the recommended first public pricing shape when the hosted product is ready.

### Free

1. `EUR 0`
2. self-hosted external URL support
3. official backend with modest limits
4. small or zero-cost managed hosting allowance when available
5. enough capacity for prototypes, hobby games, and small social sessions

### Creator

1. `EUR 8 / month`
2. annual discount option
3. managed hosting included
4. custom domain
5. deploy history and rollback
6. higher room-hours and concurrency
7. better analytics
8. private and unlisted release options

### Pro Studio

1. `EUR 24 / month`
2. annual discount option
3. more hosted games and deploy capacity
4. team access
5. advanced analytics
6. higher concurrency and usage ceilings
7. automation-oriented deploy capabilities
8. priority support

### Event Pass

1. `EUR 19` short event boost
2. `EUR 39` longer temporary boost
3. no subscription commitment
4. ideal for installations, workshops, trade shows, bars, and agency activations

This package sketch should be treated as the current strategic default unless product or infra realities later prove it wrong.

## Metering Strategy

Internal metering may track:

1. storage
2. bandwidth
3. deploy count
4. room-hours
5. peak concurrent rooms
6. backend auth and routing load

But public plan language should stay simple.

Recommended user-facing limits:

1. number of games
2. number of managed hosted games
3. monthly room-hours
4. concurrent room cap
5. publish visibility features
6. analytics depth
7. team members

Avoid surprise overages early.

Default philosophy:

1. hard caps or soft nudges on free
2. transparent limits on paid
3. no confusing micro-billing in the early product

## Recommended Product Boundary For Managed Hosting

Managed hosting should be:

1. static-site oriented
2. optimized for Air Jam games
3. deeply integrated with the dashboard and arcade

Managed hosting should not initially attempt:

1. SSR support
2. arbitrary backend code hosting
3. framework-agnostic platform engineering
4. generic CI/CD competition with Vercel

This focus reduces complexity and keeps the architecture extensible.

## Future AI Studio Compatibility

The future Air Jam game creation product should fit naturally into this strategy.

### Required Compatibility Rule

The deployment system must be designed so an agent can publish without pretending to be a human using GitHub UI flows.

That means the deploy layer should eventually expose a stable artifact-based publishing path.

### Recommended Unified Model

All creators should ultimately publish through one of these sources:

1. external URL
2. Git-connected repo
3. artifact upload
4. artifact API from Air Jam Studio

All should result in the same platform concept:

1. versioned release
2. live URL
3. optional arcade publication
4. rollback path

This is the cleanest long-term architecture.

## Public Monorepo vs Private Cloud Service

## Current Recommendation

Keep the current monorepo public.

That is the cleanest default because:

1. the open framework story stays credible
2. self-hosting remains honest and first-class
3. adoption is easier
4. trust is higher
5. there is no need to prematurely split product code before the hosted business boundary is real

The business moat should not depend on hiding the framework or the current platform UI.

The moat should come from:

1. hosted infrastructure
2. deployment workflow
3. billing and account operations
4. abuse prevention
5. internal service orchestration
6. future AI-native creation flows

## Recommended Boundary

The clean long-term boundary is:

1. public monorepo for open product and self-hostable layers
2. private cloud service for hosted-only operational layers

This means Air Jam should not rush to make `apps/platform` private.

Instead, it should introduce a private service later when hosted features become operationally real enough to justify it.

## What Should Stay Public

Recommended public surface:

1. SDK
2. create-airjam
3. docs
4. templates and examples
5. self-hostable server path
6. public-facing dashboard and platform flows that help adoption and trust

## What Should Eventually Move Behind a Private Service

Recommended private cloud-only responsibilities:

1. billing and subscription logic
2. deploy orchestration
3. artifact storage coordination
4. Git provider webhooks and deploy automation
5. signed host grants and capability issuance if that becomes a hosted premium path
6. internal analytics aggregation and derived metrics
7. AI studio orchestration
8. moderation, admin, and abuse-control internals

These are good private-service candidates because they are:

1. operationally sensitive
2. cloud-specific
3. not required to keep the framework meaningfully open

## When To Create The Private Service

Do not create it just because it sounds more professional.

Create it when at least one of these becomes true:

1. Air Jam starts handling managed deployments instead of only external URLs
2. billing or paid plan enforcement becomes real
3. secret-bearing grant issuance or deploy signing becomes part of the hosted path
4. Git-connected deploys or artifact deploys require webhook and job orchestration
5. AI studio publishing requires a trusted control plane
6. internal cloud logic is starting to distort the public product architecture

Until then, keeping things in the public monorepo is cleaner.

## Extraction Triggers

The private cloud service should be considered necessary when two or more of the following are true:

1. the public platform app is accumulating secret-dependent logic that should not live in a public web product codebase
2. deploy jobs, webhooks, and background workers need a dedicated operational boundary
3. paid plan checks are being scattered across the public app instead of enforced centrally
4. AI studio execution and publish flows need trusted orchestration
5. local development is becoming confusing because cloud-only code is mixed into general product code
6. the hosted product can no longer be explained clearly without saying "ignore these cloud internals"

Those are signs the hosted control plane has become a real product and deserves its own service boundary.

## What The First Private Service Should Be

The first private service should be a narrow cloud control plane, not a giant rewrite.

Recommended first responsibilities:

1. plan and entitlement checks
2. deploy job orchestration
3. artifact registration and release creation
4. Git webhook handling
5. signed capability or grant issuance if needed

Recommended non-goals for the first private service:

1. rewriting the dashboard
2. moving unrelated product UI
3. replacing the open server unless there is a clear hosted-only reason
4. creating a second platform just for architectural aesthetics

## Hosting The Private Service

When this service becomes necessary, a private deployment on Railway is a reasonable first choice.

Why Railway is a good initial fit:

1. low operational overhead
2. fast iteration
3. easy secret isolation
4. separate deploy boundary from the public repo

But the important decision is the service boundary, not the vendor.

Air Jam should choose Railway, Render, Fly, or similar based on operational fit at the time, without coupling the architecture to one provider too early.

## Decision Rule

Until managed deploys, billing, or trusted cloud orchestration become real product needs:

1. keep the monorepo public
2. avoid premature extraction
3. keep the future private-service boundary in mind

When those needs become real:

1. create one narrow private cloud service
2. move hosted-only logic there
3. keep the framework and open product surface public

## Licensing Strategy

## Current Recommendation

Keep the core project permissive.

Current recommendation:

1. keep the core framework under MIT
2. keep self-hosting supported
3. monetize the hosted service, not the basic right to use the framework

This best matches Air Jam's current positioning:

1. open-source framework
2. deploy anywhere
3. optional official cloud

## Why Not Change The Main License Now

Changing the core project to a more restrictive license now would likely:

1. reduce adoption
2. complicate contributor expectations
3. conflict with the current product story
4. hurt trust before the hosted value is mature

At this stage, the stronger move is to make the hosted layer compelling rather than trying to force monetization through licensing pressure.

## Long-Term License Boundary If Needed

If Air Jam later needs stronger protection, the cleaner path is:

1. keep SDK / templates / core server story permissive
2. decide separately how hosted platform-specific code should be distributed

That decision should happen only when the hosted product has a clearly separate identity and code boundary.

Until then, MIT remains the clearest recommendation.

## Strategic Non-Goals

Air Jam should not become:

1. a paywalled SDK
2. a closed-only ecosystem
3. a general-purpose cloud platform
4. a pricing model based on hidden infra math
5. a product that punishes self-hosting

## Product Summary

The intended long-term Air Jam shape is:

1. open framework
2. first-class self-host path
3. optional managed deploy path
4. hosted backend and publishing platform
5. future AI-native creation product built on the same deploy primitives

The intended monetization shape is:

1. generous free tier
2. pay for convenience, scale, and professional workflow
3. optional event-oriented pricing
4. no pressure to pay just to try, learn, or self-host

The intended licensing shape is:

1. keep MIT for the core product now
2. revisit only if the hosted layer later becomes its own clearly separate product boundary

## Closeout Rule

If future implementation or pricing plans conflict with this document, prefer the option that:

1. preserves the open framework story
2. keeps self-hosting viable
3. makes managed deployment optional but compelling
4. stays compatible with a future artifact-driven AI studio
5. charges for real operational value instead of artificial lock-in
