# First-Party Product Telemetry Plan

Last updated: 2026-08-26
Status: completed implementation plan

Related docs:

1. [../architecture/analytics-architecture.md](../architecture/analytics-architecture.md)
2. [../architecture/platform-control-plane-architecture.md](../architecture/platform-control-plane-architecture.md)
3. [../strategy/production-observability-baseline.md](../strategy/production-observability-baseline.md)
4. [../archive/2026-08-26-organic-discovery-retrospective.md](../archive/2026-08-26-organic-discovery-retrospective.md)

## Purpose

This plan owns the full replacement of Air Jam's dormant Umami integration with
one canonical first-party product telemetry system.

The system must answer discovery and conversion questions that are specific to
Air Jam without weakening the existing authority model:

1. public-request and browser telemetry is approximate discovery evidence
2. platform database lifecycle facts are authoritative for accounts, games,
   releases, and managed product state
3. realtime runtime analytics remains authoritative for rooms, controllers,
   gameplay, eligible playtime, quotas, and future accounting

One reporting surface may combine these sources. Their authority labels must
never collapse.

## Target Behavior

After this plan closes, Air Jam operators can answer:

1. which public surfaces receive human, bot, and agent traffic
2. which entry routes and normalized referrer sources lead to product intent
3. how many page views and anonymous browsing sessions occurred in a selected
   period
4. whether visitors opened the quick start, copied the scaffold command,
   entered the Arcade, or followed GitHub and npm links
5. how public discovery signals line up with authoritative account, release,
   and runtime activity without pretending browser events caused those facts
6. whether agent-facing resources such as `/llms.txt`, docs manifests, search
   indexes, and AI-pack manifests are being requested

The system must not claim durable unique people. The first release uses an
ephemeral anonymous session identity only and does not fingerprint visitors.

## Product Boundaries

### Product Telemetry Plane

Owned by the platform control plane.

Responsibilities:

1. typed public-surface events
2. same-origin browser ingestion
3. server-observed agent-resource reach
4. source and actor classification
5. append-only raw evidence
6. deterministic daily projection
7. internal operator reporting

### Platform Lifecycle Plane

Existing platform tables remain authoritative for:

1. account creation
2. game creation
3. release creation and publication
4. managed media and catalog state

Telemetry reporting reads those facts directly. It does not create duplicate
browser events such as `signup_completed` or `release_published`.

### Runtime Usage Plane

Existing `runtime_usage_*` tables and the realtime server remain authoritative
for:

1. room and runtime sessions
2. controller participation
3. active gameplay
4. eligible playtime
5. creator analytics, quotas, and future accounting

The platform telemetry ingestion route must never accept browser-supplied
runtime session facts as authoritative usage.

## Typed Event Contract

The first event union is intentionally closed and versioned.

### Browser Events

1. `page_view`
   - canonical surface
   - canonical page key
2. `quick_start_opened`
   - source placement
3. `scaffold_command_copied`
   - source placement
4. `arcade_entered`
   - source placement
5. `external_link_opened`
   - allowlisted target: `github` or `npm`

### Server-Observed Events

1. `agent_resource_requested`
   - allowlisted resource key
   - actor classification
   - normalized request source when available

### Shared Envelope

Each raw event owns:

1. client- or server-generated idempotency ID
2. schema version
3. event kind
4. bounded client occurrence time when browser-observed
5. server receipt time
6. optional ephemeral anonymous session ID
7. surface and page key
8. actor class: `human`, `bot`, `agent`, or `unknown`
9. optional normalized agent family
10. normalized referrer source and host
11. allowlisted campaign source, medium, and campaign values
12. deployment environment identity
13. strictly validated event-specific fields

The contract must not accept arbitrary event names or arbitrary JSON payloads.

## Privacy Contract

The first implementation must:

1. create a random ephemeral session ID in browser memory
2. avoid cookies, local storage, session storage, and cross-session identity
3. avoid browser fingerprinting
4. avoid raw IP persistence
5. avoid full user-agent persistence
6. avoid full URL, query-string, raw referrer, email, search-text, or arbitrary
   metadata persistence
7. retain only normalized, allowlisted campaign dimensions
8. keep local, test, preview, and production traffic explicitly separable
9. define raw-event and projection retention before production rollout

Anonymous sessions are an approximate browsing measure. They are not unique
people and must not be presented as such.

## Ingestion And Abuse Contract

The public ingestion route must:

1. accept only `POST`
2. require JSON and enforce a small request-body limit
3. require same-origin `Origin` and compatible `Sec-Fetch-Site` headers in
   production
4. validate a bounded batch size through the closed event schema
5. reject or ignore client times outside an allowed skew window
6. deduplicate event IDs
7. apply trusted-proxy-aware IP throttling without persisting the IP
8. classify actor type from request headers without storing the raw user agent
9. fail silently in the client so telemetry can never break product UX
10. label production, preview, development, and test traffic explicitly

Bot and agent traffic must be classified and reported separately, not silently
discarded. AI-mediated discovery is a first-class product question for Air Jam.

## Persistence And Projection

The platform schema will add:

1. `product_telemetry_events`
   - append-only validated evidence
   - unique idempotency ID
2. `product_telemetry_daily_metrics`
   - deterministic daily counts by canonical dimensions
3. `product_telemetry_daily_session_contributions`
   - one contribution per day, ephemeral session, and reporting dimension so
     daily anonymous-session counts remain incrementally correct

Ingestion and projection occur in one database transaction:

1. insert unseen raw event
2. increment the matching daily event count
3. insert the daily session contribution when a session exists
4. increment daily anonymous-session count only when that contribution is new

The projector must also expose a deterministic rebuild path from the raw ledger
so aggregates can be verified and regenerated after contract changes.

Retention target for the first rollout:

1. raw browser telemetry: 90 days
2. daily session contribution keys: 90 days after their aggregate is stable
3. daily aggregate metrics: retained long-term
4. server-observed agent-resource events: same raw retention rule

Retention cleanup must be explicit and testable; it must not be hidden in read
queries.

## Collection Surfaces

### Browser Navigation

One platform client boundary records App Router page transitions for canonical
public surfaces:

1. landing
2. docs
3. blog
4. Arcade
5. login
6. dashboard

### Meaningful Intent

Typed helpers instrument the existing landing-page actions and any equivalent
canonical calls to action without exposing a generic string-event API.

### Agent-Facing Reach

Server-owned route handlers record requests for:

1. `/llms.txt`
2. `/docs-manifest`
3. `/docs-search-index`
4. the canonical AI-pack manifest

Actor and agent-family classification is indicative. It must never be described
as proof that a specific model produced a later recommendation.

## Internal Reporting Surface

Add an ops-only API and dashboard page separate from creator game analytics.

The initial view exposes selectable 7-, 30-, and 90-day windows with:

1. page views
2. anonymous sessions
3. human, bot, agent, and unknown traffic split
4. daily trend
5. top canonical pages
6. normalized referrer sources
7. meaningful intent counts
8. agent-resource reach and agent-family split
9. platform lifecycle facts for the same window
10. authoritative runtime activity for the same window, clearly labeled as a
    separate evidence source

The API uses `opsProcedure`. It does not expand the creator-facing analytics
router or expose raw events to the browser.

## Full Umami Purge

This work is incomplete until all obsolete Umami paths are removed:

1. external script component
2. browser global adapter
3. provider and website-ID environment variables
4. platform layout mount
5. `cloud.umami.is` CSP allowance
6. CSP tests that require the Umami origin
7. platform README setup instructions
8. live strategy language that treats Umami as a supported direction

Archived historical documents remain unchanged.

## Documentation Deliverables

Implementation must add or update:

1. `docs/architecture/product-telemetry-architecture.md`
2. `docs/contracts/product-telemetry-contract.md`
3. `docs/architecture/analytics-architecture.md` with the two-plane boundary
4. `docs/strategy/production-observability-baseline.md`
5. `docs/capability-inventory.md`
6. `apps/platform/README.md`
7. `.env.example` only if the final implementation has real telemetry-specific
   configuration
8. `docs/current-state.md` and `docs/work-ledger.md` at phase closure

When complete, archive this plan with the date-first naming rule and remove it
from the active plan surface.

## Test And Validation Contract

Required automated proof:

1. event schema accepts every canonical event and rejects arbitrary names or
   payloads
2. source, referrer, campaign, page, actor, and agent classification is bounded
   and deterministic
3. same-origin and request-size guards reject invalid ingestion requests
4. rate limiting uses request identity only transiently
5. event ID replay does not double-count raw or aggregate data
6. repeat events in one anonymous session increment events but not session
   counts twice for the same daily dimension
7. projection rebuild reproduces incremental aggregates
8. ops authorization protects reporting APIs and pages
9. reporting keeps product telemetry, platform lifecycle facts, and runtime
   usage facts visibly distinct
10. public navigation and canonical intent actions emit the expected typed
    events
11. agent-facing resources still return their exact canonical content while
    recording reach
12. no live code, env, CSP, or documentation reference to Umami remains
13. the full operator lifecycle is discoverable through the repo CLI with
    stable JSON output and safe preview/apply mutation semantics
14. CLI and UI operation share reporting, projection, and retention domain
    services rather than duplicating policy

Required repository gates:

1. platform typecheck
2. platform lint
3. platform tests
4. platform production build
5. relevant repo contract checks

Required browser proof:

1. landing page renders with no external analytics script
2. navigation and CTA actions succeed with telemetry ingestion visible in
   local request and reporting state
3. Arcade navigation remains intact
4. ops telemetry dashboard renders the separated evidence groups
5. public agent resources remain fetchable

## Execution Order

### Phase 1. Contract And Persistence

1. land the typed event contract
2. land platform-only schema and migration
3. implement deterministic classification and projection
4. add projector rebuild and retention seams

### Phase 2. Ingestion And Collection

1. add hardened first-party ingestion
2. add client navigation tracking
3. replace landing event calls with typed intent helpers
4. add server-observed agent-resource reach

### Phase 3. Reporting

1. add ops-only aggregate API
2. add internal telemetry dashboard
3. combine evidence sources at read time with explicit authority labels

### Phase 4. Purge And Documentation

1. remove every Umami path
2. add architecture and contract docs
3. align capability, observability, platform, current-state, and ledger docs

### Phase 5. Full Proof And PR

1. run focused tests
2. run repository quality gates
3. run local browser proof
4. inspect the final diff for unrelated worktree contamination
5. commit only scoped files
6. push the feature branch
7. open the PR with architecture, privacy, migration, and proof notes

### Phase 6. Agent-First Operator Contract

1. expose overview and health reads through the canonical repo CLI
2. expose deterministic rebuild and retention preview/apply commands
3. add stable JSON envelopes and discoverable help
4. encode agent-first operability in the repository governing rules
5. prove the CLI against local PostgreSQL and repo contract tests

## Done Criteria

This plan is complete only when:

1. every target behavior is implemented
2. every authority boundary is preserved
3. every privacy and abuse rule is enforced or explicitly proven unnecessary
4. daily projections are reproducible
5. the ops read surface is usable
6. agent-facing reach is observable
7. Umami is absent from every live implementation and documentation surface
8. all required automated and browser proofs pass
9. the full implementation is committed, pushed, and represented by an open PR
10. this plan is archived and the canonical docs describe the shipped system
11. agents can inspect, verify, rebuild, and retain telemetry without UI
    scraping or ad hoc SQL
