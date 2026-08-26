# Product Telemetry Architecture

Last updated: 2026-08-26
Status: implemented architecture

Related docs:

1. [Product Telemetry Contract](../contracts/product-telemetry-contract.md)
2. [Analytics Architecture](./analytics-architecture.md)
3. [Platform Control Plane Architecture](./platform-control-plane-architecture.md)
4. [Production Observability Baseline](../strategy/production-observability-baseline.md)

## Purpose

This document explains Air Jam's first-party product telemetry plane: the
platform-owned system that records bounded discovery evidence, projects it into
stable daily metrics, and presents it to internal operators.

It exists to keep three kinds of evidence useful without making them
interchangeable:

1. product telemetry is approximate evidence about public requests, browsing,
   and product intent
2. platform lifecycle records are authoritative for accounts, games, releases,
   and managed product state
3. runtime usage analytics is authoritative for rooms, controllers, gameplay,
   eligible playtime, quotas, and future accounting

## Core Position

Air Jam owns one small telemetry plane shaped around its product questions. It
does not load a third-party analytics script, expose a generic event firehose,
or promote browser observations into gameplay or business authority.

The platform control plane owns collection, validation, persistence,
projection, retention, and operator reporting. The browser is only an
untrusted source of a closed set of navigation and intent observations.

## Authority Model

### Product Telemetry

Product telemetry can answer:

1. which public surfaces and canonical pages received traffic
2. how traffic split across indicative human, bot, agent, and unknown actors
3. which normalized referrer and campaign sources brought requests
4. whether a browser opened the quick start, copied the scaffold command,
   entered the Arcade, or followed an allowlisted external link
5. whether an agent-facing resource was requested
6. how many ephemeral anonymous browsing sessions contributed to a daily slice

These facts are useful discovery evidence. They are not proof of a durable
person, attribution, causation, gameplay, or revenue.

### Platform Lifecycle Facts

The platform database remains authoritative for facts such as:

1. account creation
2. game creation
3. release creation
4. release publication

The reporting layer reads these records directly for the selected time window.
It does not duplicate them as browser completion events.

### Runtime Usage Analytics

The realtime server and runtime usage ledger remain authoritative for:

1. runtime and room sessions
2. controller participation
3. active gameplay
4. eligible playtime
5. creator analytics, quotas, and future accounting

The product telemetry route does not accept runtime usage claims from the
browser. Runtime analytics is documented in
[Analytics Architecture](./analytics-architecture.md).

## System Shape

The telemetry flow has five boundaries:

1. a platform client collector observes canonical navigation and typed intent
   actions
2. a server-owned request boundary records agent-resource reach independently
   of the browser
3. the ingestion boundary applies request guards, validates the closed event
   union, and derives trusted classifications
4. one transaction writes unseen raw evidence and updates its daily projection
5. an ops-only read surface combines telemetry aggregates with separately
   labeled lifecycle and runtime facts

Collection failures are non-fatal to product behavior. Navigation, copy,
external links, Arcade entry, and agent-resource responses must continue even
when telemetry cannot be recorded.

## Collection Boundaries

### Browser Navigation

One client-side boundary observes App Router transitions and emits one typed
page-view event for canonical platform surfaces:

1. landing
2. docs
3. blog
4. Arcade
5. authentication
6. dashboard

The server maps the bounded pathname to a canonical surface and page key.
Unknown or high-cardinality paths do not become arbitrary reporting
dimensions.

### Meaningful Product Intent

Landing and navigation components call dedicated typed helpers for the small
set of supported intent actions. Product components do not receive a generic
`track(name, payload)` API.

This keeps the analytics vocabulary deliberate and prevents accidental
collection of arbitrary component state, user text, or metadata.

### Agent-Facing Reach

The server request boundary for `/llms.txt`, the docs manifest, the docs search
index, and the canonical AI-pack manifest records a server-observed request
event while preserving the exact resource response.

Header-based actor and agent-family classification is indicative. It can show
that a resource was requested by a recognizable client family; it cannot prove
that a particular model later used or recommended the resource.

## Trust Boundary And Normalization

The ingestion route treats every browser field as untrusted.

It accepts only the versioned event contract, then derives or normalizes:

1. canonical surface and page key
2. actor class and optional agent family
3. referrer source and bounded host
4. allowlisted campaign dimensions
5. deployment environment
6. server receipt time

Request headers may be used transiently for same-origin enforcement,
classification, and trusted-proxy-aware throttling. Raw IP addresses and full
user-agent strings are not persisted.

Production and preview browser ingestion require exact same-origin request
context. The route also enforces JSON, a 16 KiB body limit, at most 20 events
per batch, a client-time window from 24 hours in the past through 5 minutes in
the future, event-ID deduplication, and rate limiting.

## Persistence And Projection

The storage model has three responsibilities:

1. an append-only raw event ledger preserves validated evidence
2. a daily aggregate stores event and anonymous-session counts by bounded
   reporting dimensions
3. a daily session-contribution ledger records whether an ephemeral session has
   already contributed to a specific daily reporting slice

For each valid event, one transaction:

1. inserts the raw event only when its idempotency ID is unseen
2. increments the corresponding daily event count
3. inserts a contribution when an anonymous session exists
4. increments the daily anonymous-session count only for a new contribution

An event-ID replay therefore changes neither the ledger nor the projection. A
repeat event from the same ephemeral session can increase the event count while
leaving the matching daily session count unchanged.

The projector also has a deterministic rebuild path from the raw ledger. This
keeps aggregates auditable and allows a deliberate full recomputation after a
contract or projection change.

## Reporting Surface

Product telemetry is an internal operator product, separate from creator game
analytics.

The ops-only `/dashboard/ops/telemetry` surface supports 7-, 30-, and 90-day
windows and presents:

1. page views and ephemeral anonymous sessions
2. actor-class split and daily trend
3. top canonical pages and normalized referrer sources
4. meaningful intent counts
5. agent-resource reach and indicative agent-family split
6. platform lifecycle facts for the same period
7. authoritative runtime activity for the same period

Each group carries its own evidence-source label. The read layer may align
counts by time window, but it does not manufacture causal conversion claims.
Raw events are not sent to the browser.

## Agent And CLI Operability

The ops dashboard is not the only operator surface. The canonical repo CLI
exposes the same domain behavior through:

1. `platform telemetry overview` for the authority-separated 7-, 30-, or
   90-day report
2. `platform telemetry health` for storage, projection, and retention state
3. `platform telemetry rebuild` for deterministic projection preview and apply
4. `platform telemetry retain` for retention preview and apply

Reads support a stable versioned JSON envelope. Mutating commands are read-only
previews unless `--apply` is present. The CLI calls the same reporting,
projection, and retention services as the platform rather than reimplementing
queries or policy.

Local operation uses `DATABASE_URL` or `apps/platform/.env.local`. Hosted
operation accepts an explicit Railway environment and project identity,
resolves the environment PostgreSQL connection internally through the repo's
Railway boundary, and never prints the credential. Machine consumers use the
silent repo invocation so stdout contains only the JSON contract.

This is an architectural requirement: future telemetry operations must land in
the machine contract alongside any human UI. Direct SQL and browser automation
remain diagnostic fallbacks, not canonical operation.

## Privacy Model

The browser creates a random anonymous session ID in memory. It is discarded
when that page context ends and is never written to cookies, local storage, or
session storage.

The system does not persist:

1. raw IP addresses
2. full user-agent strings
3. full URLs or query strings
4. raw referrers
5. email addresses
6. search text
7. arbitrary metadata
8. fingerprint-derived identifiers

Campaign input is reduced to bounded, allowlisted dimensions. Production,
preview, development, and test traffic remain separable so non-production
activity cannot silently contaminate production reporting.

Anonymous-session counts are approximate browsing-session measures. Product
copy and operator reporting must never call them unique people.

## Retention And Maintenance

The initial retention policy is:

1. raw product telemetry events: 90 days
2. daily session-contribution records: 90 days after their aggregate is stable
3. daily aggregate metrics: long-term

Retention runs as explicit maintenance behavior with testable boundaries. Read
queries do not delete or conceal expired evidence as a side effect.

## Failure And Evolution Rules

1. Telemetry never blocks or changes public product behavior.
2. Unknown event names, fields, and payloads are rejected rather than stored.
3. Contract changes use an explicit schema version and a deliberate full
   migration; Air Jam does not preserve obsolete event paths for compatibility.
4. Projection changes must remain reproducible from retained raw evidence.
5. New product questions should first prove they fit this bounded plane; they
   must not weaken privacy or authority boundaries.
6. New gameplay, quota, billing, or payout questions belong in runtime usage
   analytics, not product telemetry.

## Design Rules

1. Keep event names closed, typed, and product-specific.
2. Derive trusted dimensions on the server.
3. Keep raw evidence append-only and projections reproducible.
4. Keep browser sessions ephemeral and make no durable-person claim.
5. Classify bot and agent traffic instead of silently discarding it.
6. Keep lifecycle, product-telemetry, and runtime facts visibly distinct at
   read time.
7. Prefer one canonical first-party system over parallel analytics adapters.
8. Keep the full operator lifecycle discoverable and machine-readable through
   the repo CLI.
