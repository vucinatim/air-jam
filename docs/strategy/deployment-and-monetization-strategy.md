# Air Jam Deployment and Monetization Strategy

Last updated: 2026-08-28
Status: stable strategy

Related docs:

1. [Framework Paradigm](../framework-paradigm.md)
2. [Auth Capability Plan (Archived)](../archive/2026-03-31-auth-capability-plan.md)
3. [Public Arcade Release Strategy](./public-arcade-release-strategy.md)
4. [Vision](../vision.md)
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
4. remains compatible with the agent-operable Air Jam creation and evaluation
   harness

## Core Position

Air Jam should not monetize by restricting the framework or the development harness
itself.

The framework should remain easy to adopt, easy to self-host, and honest about its boundaries.

The monetizable layer is the hosted service around the framework:

1. official realtime backend
2. dashboard and app identity management
3. arcade publishing and discovery
4. optional managed deployment
5. professional automation and operational workflows

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

Free does not mean unbounded shared infrastructure. The normal hobby path should
feel generous, while every cost-producing hosted capability has a transparent
limit, queue, or safe degradation mode.

The durable promise is:

> Unlimited creativity, bounded shared infrastructure.

#### Ratified 1.0 Commercial Posture

Air Jam 1.0 is free with generous infrastructure limits:

1. no payments, checkout, subscription, credit-card requirement, or player
   paywall is required for the release
2. creators bring their own model account and may self-host or bring their own
   cloud
3. the official hobby cloud uses the exact allowances and `$100` ordinary /
   `$150` launch-cycle ceilings ratified in the
   [1.0 release roadmap](../plans/v1-release-roadmap-plan.md)
4. metering, queues, quotas, usage inspection, spend alerts, degradation, and
   kill switches are release requirements even though charging is not
5. a future paid experiment begins only after the roadmap's activation,
   retention, demand, or recurring-cost triggers are met

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

### 5. The Development Harness Is Free, Not A Paid Model Wrapper

Air Jam's development harness is the complete creation and evaluation capability exposed
through the framework, runtime, CLI, MCP, logs, state, visual inspection,
evaluation, and release contracts.

It should remain free because:

1. creators bring their own Codex, Claude, T3 Code, terminal agent, or future
   model client
2. local development compute normally runs on the creator's machine
3. hosted build or sandbox compute may run in the creator's own cloud account
4. Air Jam does not need to subsidize general-purpose model inference
5. a future hosted UI should be an optional control room using the same public
   contracts, not a required authoring surface

The same release system must support:

1. external self-hosted games
2. creator-owned cloud deployments
3. Git-connected game repositories
4. uploaded build artifacts
5. agent-produced artifacts through the public release API

### 6. No Free Action May Create Unbounded Cost

This is the economic constitution for the hosted product:

1. Air Jam operates within one explicit monthly learning/subsidy budget
2. the budget is chosen by the maintainer based on what feels safe to lose, not
   inferred from signup count
3. every cost-producing free capability has a per-user, per-game, per-event, or
   global bound
4. expensive work is queued and concurrency-limited
5. safe caps, pauses, or degraded modes take effect before provider overages
6. self-hosting and bring-your-own-cloud remain available when official free
   capacity is exhausted
7. paid usage must cover its expected marginal cost and operational risk
8. no creator reward is funded from the maintainer's personal money

### 7. Monetization Follows Activation, Not Registration

Air Jam must not wait for or price around an arbitrary signup threshold such as
1,000 accounts.

Signups may be inactive, automated, or nearly free. One active workload may be
more expensive and informative than thousands of dormant accounts.

The meaningful signals are:

1. creators who finish and publish a game
2. creators who return and update or create another game
3. games that receive repeat organic play
4. real room-hours, concurrency, release jobs, storage, and provider cost
5. repeated requests for private games, branding, domains, event capacity,
   teams, analytics, or guarantees
6. users reaching a real free boundary and asking to continue
7. infrastructure approaching the explicit learning budget

## Product Shape

Air Jam should have four cooperating lanes.

### Lane 1. Open Framework + Agent Development Harness

This is the current core product:

1. SDK
2. server
3. app identity
4. dashboard
5. semantic game sessions and evaluation
6. agent-facing CLI and MCP
7. release tooling

This lane drives adoption.

### Lane 2. Self-Hosting + Bring Your Own Cloud

This is the economically independent path:

1. creator-hosted static game deployment
2. creator-owned provider account
3. Air Jam-compatible deployment automation
4. optional connection to the official backend within free or paid limits

This lane keeps the product genuinely open and prevents adoption from becoming
an automatic Air Jam infrastructure liability.

### Lane 3. Official Air Jam Cloud

This is the monetization-friendly convenience layer:

1. hosted static deploys
2. deploy versioning
3. custom domains
4. rollback
5. Git-connected deploys
6. official realtime capacity
7. operational analytics and recovery
8. private/team/event capabilities

This lane provides a bounded free entry point and eventually drives recurring or
event-shaped revenue.

### Lane 4. Arcade Distribution And Creator Economy

This is the later network-value lane:

1. discovery and trusted public distribution
2. free and creator-selected premium games
3. optional host-paid access to a premium catalog
4. event licensing and branded game distribution
5. marketplace transactions and creator revenue share

This lane becomes monetizable only after the catalog and repeat play create real
consumer or host value.

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

## Public Arcade Rule

Air Jam should distinguish between:

1. framework-level self-hosting
2. trusted public Arcade distribution

Self-hosting should stay open and URL-friendly.

Public Arcade should increasingly prefer immutable Air Jam-controlled releases over mutable third-party URLs.

That split keeps the framework honest while giving the hosted product a defensible trust model.

### Deployment Input A. External URL

This remains the default and most open path.

Flow:

1. developer deploys on Vercel / Netlify / Cloudflare / custom hosting
2. developer enters the URL in Air Jam
3. Air Jam uses that URL for self-hosted play, external distribution, and non-hosted platform integrations

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
2. external agents publishing from any compatible local or hosted environment

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
5. agent-produced artifact publishing

This is a much cleaner and more defensible product boundary.

## Recommended Rollout Order

### Phase 1. External URL First

Keep improving the current model:

1. self-hosted game URL in dashboard
2. app ID issuance
3. external and private play flows remain easy

This remains the lowest-friction open path.

### Phase 2. Artifact Deploy

Add the simplest managed deployment path first.

Why first:

1. smallest implementation surface
2. useful for advanced users immediately
3. necessary foundation for agent-first publishing
4. avoids needing Git provider integration as the first step
5. gives public Arcade a trusted immutable release primitive instead of relying on mutable third-party URLs

### Phase 3. Git-Connected Deploy

Add GitHub-connected deploys when the core version/deploy model is stable.

Why after artifacts:

1. Git integration is productively valuable but operationally heavier
2. it should reuse the same version/deploy pipeline
3. it is easier once artifact deployment already exists internally

### Phase 4. Agent And Harness Publish API

External agents and any future hosted control room should publish through
the same deploy API as artifact uploads.

This avoids a split system.

## Monetization Strategy

### Emotional Contract

The product promise is:

1. build for free
2. use the complete development harness for free
3. test locally for free
4. self-host or bring your own cloud if you want
5. use a genuinely useful but economically bounded official free cloud
6. pay only when Air Jam is saving meaningful time, carrying meaningful usage,
   or providing professional/event value

Air Jam should not primarily charge for:

1. using the SDK
2. using CLI, MCP, semantic sessions, or evaluation contracts
3. basic experimentation
4. ordinary local development
5. small hobby games
6. self-hosting

### What Air Jam May Charge For

1. official backend usage beyond the free hobby envelope
2. managed deployment, version history, rollback, and recovery
3. private or unlisted games
4. custom domains and branding
5. advanced analytics and longer retention
6. team, agency, and client workspaces
7. event capacity and operational guarantees
8. priority support and professional incident response
9. future marketplace transactions or premium Arcade access

### Early Demand Reality

Air Jam is a niche and partially category-creating product. Most people do not
already think, "I should make a phone-controller multiplayer game."

The initial discovery message should lead with outcomes people already want:

1. turn an inside joke into a party game
2. make a quiz for tonight
3. create something for an office party, classroom, conference, or bar
4. ask an agent to turn one prompt into a multiplayer experience
5. let everyone join using the phones already in the room

The first business question is therefore not price sensitivity. It is whether
Air Jam can make this previously unfamiliar possibility understandable and
repeatable.

### Fixed Learning Budget

Before repeat demand exists, official free-cloud cost is a deliberate product
learning and acquisition expense.

Rules:

1. choose one maximum monthly amount that is emotionally and financially safe
   to lose
2. treat that amount as a hard product budget, not a target to exceed
3. alert before the budget is approached
4. queue, pause, cap, or degrade optional hosted capabilities before an overage
5. do not increase the budget merely because signups increased
6. increase it only when activation, retention, revenue, or a deliberate launch
   experiment justifies the change

Air Jam should consume a known budget while learning. It should never consume
an unknown budget while waiting for an arbitrary number of accounts.

### Sustainable Free Cloud

The free cloud should feel unrestricted during normal hobby use while remaining
bounded at the infrastructure layer.

Possible user-facing allowances include:

1. one or more public games
2. a modest hosted artifact and media allowance
3. ordinary small-group room-hours
4. a reasonable concurrent room/controller ceiling
5. a small number of release-validation/browser jobs
6. shared best-effort capacity without an uptime guarantee

Required implementation behavior:

1. no surprise overages
2. no session is interrupted merely to present a payment screen
3. current active play should finish safely when practical
4. starting new expensive work may queue or stop at the published boundary
5. usage status and the available next action are visible
6. self-hosting and bring-your-own-cloud are always explained as valid options

### Bring Your Own Cloud

BYOC is strategically important because it separates product adoption from Air
Jam's infrastructure liability.

The agent-first harness should eventually be able to:

1. deploy into a creator-controlled provider account
2. configure the required Air Jam runtime contracts
3. inspect provider state through agent-safe tooling
4. retain the same game-version and release model used by official hosting
5. keep provider credentials under the creator's control

Air Jam may later charge for professional orchestration or team policy around
BYOC, but the underlying provider bill belongs to the creator.

## Monetization Stages

### Stage 1. Discovery

Default product state for 1.0:

1. framework and development harness are free
2. reference games are free
3. official cloud is bounded by the fixed learning budget
4. no required checkout or consumer subscription
5. optional sponsorship may help with open-source baseline costs

Success signals:

1. strangers complete the create-to-publish loop
2. creators return independently
3. published games receive real play
4. players become curious about creating or remixing

### Stage 2. Retention

Add only the loops that make real use repeatable:

1. clear creator usage and cost reporting
2. BYOC deployment
3. sharing and remixing through agents
4. visible but tasteful `Made with Air Jam` discovery
5. better creator analytics
6. manual event or agency arrangements when requested

Billing infrastructure is still optional if no valuable boundary has emerged.

### Stage 3. Proven Paid Value

Introduce paid products only after users demonstrate demand for one of these
boundaries:

1. more event capacity
2. private/unlisted distribution
3. branding or custom domains
4. managed reliability and recovery
5. team or client workflows
6. advanced analytics
7. higher official-cloud usage

Do not invent a complex subscription boundary and then hope users care about
it.

### Stage 4. Arcade Economy

Only after Air Jam has a catalog with repeat player demand should it consider:

1. premium creator-selected games
2. a host-paid Arcade catalog pass
3. event/game licenses
4. marketplace sales or bundles
5. revenue sharing with creators

## Monetization Triggers

Do not use total signups as the trigger.

Review monetization when one or more of these become true:

1. a meaningful cohort publishes at least one game
2. a smaller cohort returns within a normal retention window
3. several games receive repeat organic sessions
4. users repeatedly reach a real free boundary
5. users ask to pay for private games, events, branding, domains, teams,
   analytics, or guarantees
6. provider cost approaches the explicit learning budget
7. a professional user asks for reliability or support Air Jam cannot promise
   for free

The exact numerical thresholds belong in the current 1.0 release roadmap and
should be chosen from observed cost and behavior, not intuition.

## Revenue Priority

The likely order of credible revenue is:

1. event passes and temporary capacity
2. agency/professional plans and support
3. managed official-cloud convenience
4. team/private/analytics capabilities
5. marketplace or premium Arcade revenue after catalog demand exists
6. sponsorship as a supplement, not the core hosted business model

Event and agency demand may appear before broad framework popularity because a
single high-intent customer can value one reliable occasion more than many
hobbyists value a monthly subscription.

## Pricing Policy

Do not lock public prices before Air Jam can measure:

1. cost per active creator
2. cost per hosted release
3. cost per room-hour and controller-hour
4. peak-concurrency cost
5. browser-worker/release-validation cost
6. storage and bandwidth cost
7. support and operational time

Any previous illustrative `EUR 8`, `EUR 24`, `EUR 19`, or `EUR 39` amounts are
retired as defaults. Future prices are hypotheses that must cover expected
marginal cost, risk, payment fees, support, and a sustainable margin while
remaining legible to users.

Public pricing should use value-shaped units such as:

1. hosted games
2. room-hours or event windows
3. concurrent rooms
4. private/public visibility
5. team members
6. analytics and operational features

Avoid raw websocket-message billing and confusing micro-overages.

## Future Arcade Subscription

A consumer or host subscription is allowed as a later option, not a 1.0
assumption.

It becomes reasonable only when:

1. the catalog has enough quality and variety to justify recurring access
2. players or hosts return for the catalog rather than one specific event
3. creators can knowingly choose free or premium distribution
4. payment, tax, refund, payout, abuse, and entitlement operations are ready

Preferred interaction model:

1. the host unlocks the room or catalog; controllers never need to pay
2. open-source reference games remain free
3. free users receive complete sessions or clearly stated allowances
4. an active social session is not cut off by a surprise paywall
5. when an allowance is exhausted, the current session may finish but new
   premium sessions require renewal, payment, self-hosting, or the next free
   window

## Creator Monetization And Rewards

Air Jam must never promise uncapped pay-per-minute rewards or fund creator
payouts from the maintainer's personal money.

Safe progression:

1. creator analytics
2. discovery and featured placement
3. paid event/game sales where customer revenue exists
4. marketplace or subscription revenue share
5. sponsor-funded grants or credits
6. capped reward pools only after abuse controls and unit economics are proven

Canonical funding rule:

`creator pool = min(approved percentage of net realized revenue, fixed monthly cap)`

If realized revenue or sponsor funding is zero, the reward pool is zero.
Eligible playtime may help allocate an existing pool after fraud controls exist;
it must never manufacture a liability by itself.

## Metering Strategy

Internal cost and usage accounting should track:

1. storage and bandwidth
2. deploy and validation jobs
3. room-hours and eligible playtime
4. controller-hours and peak concurrency
5. database and backend load
6. per-game, per-owner, per-plan, and global usage
7. provider cost and budget consumption

Runtime usage remains the authority for quota and billing facts. Product
telemetry remains approximate discovery evidence and must not drive charges,
payouts, or critical enforcement.

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

## Agent Development Harness Compatibility

Air Jam's free creation and evaluation harness should fit naturally into this
strategy without requiring Air Jam to subsidize general-purpose model
inference.

### Required Compatibility Rule

The deployment system must be designed so an external agent can publish without
pretending to be a human using GitHub UI flows.

That means the deploy layer should eventually expose a stable artifact-based publishing path.

### Recommended Unified Model

All creators should ultimately publish through one of these sources:

1. external URL
2. Git-connected repo
3. artifact upload
4. artifact API used by any compatible agent or future hosted control room

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
6. professional agent orchestration and operational workflows

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
7. optional hosted agent orchestration when Air Jam itself provides paid
   compute
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
5. hosted agent publishing requires a trusted control plane
6. internal cloud logic is starting to distort the public product architecture

Until then, keeping things in the public monorepo is cleaner.

## Extraction Triggers

The private cloud service should be considered necessary when two or more of the following are true:

1. the public platform app is accumulating secret-dependent logic that should not live in a public web product codebase
2. deploy jobs, webhooks, and background workers need a dedicated operational boundary
3. paid plan checks are being scattered across the public app instead of enforced centrally
4. optional Air Jam-funded agent execution and publish flows need trusted
   orchestration
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
2. free agent-operable development harness
3. first-class self-host and bring-your-own-cloud paths
4. useful but bounded official free cloud
5. optional paid managed, professional, and event capabilities
6. hosted backend, deployment, and Arcade distribution platform
7. creator economy only after funded demand exists

The intended monetization shape is:

1. a fixed learning budget rather than an arbitrary signup threshold
2. activation, retention, cost, and user demand as monetization triggers
3. pay for convenience, scale, professional workflow, or event capacity
4. creator rewards funded only from realized revenue or sponsors
5. optional premium Arcade access only after the catalog proves repeat demand
6. no pressure to pay just to create, learn, or self-host

The intended licensing shape is:

1. keep MIT for the core product now
2. revisit only if the hosted layer later becomes its own clearly separate product boundary

## Closeout Rule

If future implementation or pricing plans conflict with this document, prefer the option that:

1. preserves the open framework story
2. keeps the development harness free and fully agent-operable
3. keeps self-hosting and bring-your-own-cloud viable
4. makes managed deployment optional but compelling
5. bounds the maintainer's infrastructure exposure before launch
6. charges for real operational value instead of artificial lock-in
7. creates no payout liability without an existing funded pool
