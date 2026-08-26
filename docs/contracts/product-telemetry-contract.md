# Product Telemetry Contract

Last updated: 2026-08-26
Status: current contract

Related docs:

1. [Product Telemetry Architecture](../architecture/product-telemetry-architecture.md)
2. [Analytics Architecture](../architecture/analytics-architecture.md)
3. [Production Observability Baseline](../strategy/production-observability-baseline.md)

## Purpose

This document defines the stable event, privacy, ingestion, projection, and
reporting rules for Air Jam product telemetry.

## Authority Contract

Product telemetry is approximate discovery evidence. It may describe public
requests, browsing sessions, navigation, and a bounded set of product-intent
actions.

It is not authoritative for:

1. durable unique people
2. account, game, or release lifecycle completion
3. runtime sessions or controller participation
4. gameplay, eligible playtime, quotas, billing, or creator rewards
5. causal attribution between a request and a later lifecycle or runtime fact

Platform lifecycle records and runtime usage analytics retain those respective
authority boundaries.

## Versioning Rule

The event union is closed and explicitly versioned. Version 1 is the only
accepted browser schema until the contract is deliberately replaced.

The ingestion boundary rejects:

1. unknown event kinds
2. unknown object fields
3. arbitrary JSON payloads
4. unsupported schema versions
5. values outside their bounded enums or formats

Air Jam does not keep obsolete event shapes alive for backwards compatibility.
A contract replacement requires synchronized collectors, ingestion,
projection, tests, and documentation.

## Canonical Event Union

### Browser-Observed Events

Version 1 accepts exactly:

1. `page_view`
2. `quick_start_opened` with a canonical placement
3. `scaffold_command_copied` with a canonical placement
4. `arcade_entered` with a canonical placement
5. `external_link_opened` with a canonical placement and allowlisted `github`
   or `npm` target

### Server-Observed Event

Server-owned agent-resource handlers may record:

1. `agent_resource_requested` with an allowlisted resource key

The allowlisted resources are:

1. `llms_txt`
2. `docs_manifest`
3. `docs_search_index`
4. `ai_pack_manifest`

Browser ingestion must not accept the server-observed event kind.

## Browser Envelope

Every browser event contains:

1. a UUID event ID used for idempotency
2. schema version `1`
3. an offset-aware client occurrence timestamp
4. a random UUID anonymous-session ID
5. a bounded pathname containing no query string
6. an optional normalized referrer host
7. optional campaign dimensions
8. the event-specific fields defined by the discriminated union

The browser does not send actor class, agent family, deployment environment,
server receipt time, canonical surface, canonical page key, raw IP address, or
full user-agent string as trusted facts. The server owns those values.

## Bounded Dimensions

Canonical surfaces are:

1. `landing`
2. `docs`
3. `blog`
4. `arcade`
5. `auth`
6. `dashboard`
7. `agent_resource`
8. `other`

Actor classes are:

1. `human`
2. `bot`
3. `agent`
4. `unknown`

Indicative agent families are bounded to the implemented allowlist plus an
`other` fallback. Absence of a recognized family must remain representable.

Normalized referrer sources are:

1. `direct`
2. `internal`
3. `search`
4. `social`
5. `ai`
6. `github`
7. `npm`
8. `other`

Deployment environments are:

1. `production`
2. `preview`
3. `development`
4. `test`

Canonical intent placements are:

1. `landing_hero`
2. `landing_final`
3. `header`
4. `footer`
5. `docs`
6. `arcade`

Campaign source, medium, and campaign values are optional, individually
bounded, and restricted to a conservative character set. An empty campaign
object is invalid.

## Normalization Contract

The server deterministically derives or normalizes:

1. canonical surface and page key from pathname or resource identity
2. actor class from request headers
3. optional agent family from request headers
4. referrer source from same-origin state and bounded referrer host
5. allowlisted campaign values
6. deployment environment from trusted server configuration
7. server receipt time

Classification is indicative rather than identity proof. Bot and agent traffic
must be retained in separate dimensions rather than discarded.

The stored event model contains only normalized dimensions needed for defined
reporting. It does not preserve high-cardinality request data merely because it
was available during ingestion.

## Privacy Contract

The browser anonymous-session ID:

1. is randomly generated
2. exists only in memory
3. may group events within the current page context
4. is not a cookie or durable identity
5. is not a unique-person measure

The system must not persist:

1. raw IP addresses
2. full user-agent strings
3. full URLs or query strings
4. raw referrers
5. emails or other account identifiers as telemetry dimensions
6. search text
7. arbitrary metadata
8. fingerprint inputs or derived fingerprints

The client must not use cookies, local storage, or session storage for
telemetry identity.

## Browser Ingestion Contract

The same-origin ingestion route:

1. accepts only `POST`
2. requires JSON
3. rejects request bodies larger than 16 KiB
4. accepts a strict object containing 1 through 20 events
5. validates every event against the closed versioned union
6. accepts occurrence times from no more than 24 hours in the past through 5
   minutes in the future and rejects the entire invalid batch
7. requires the exact platform `Origin` and `Sec-Fetch-Site: same-origin` in
   production and preview
8. allows 60 requests per 60-second window per transient IP hash; forwarded IP
   headers are trusted only on Railway or Vercel and neither the address nor its
   hash is persisted
9. deduplicates by event ID

Invalid input must not produce partially trusted stored data. Telemetry-client
failures are swallowed at the collection boundary so product UX continues.

## Server-Observed Resource Contract

Agent-resource telemetry is created by the resource route, not supplied through
the browser event endpoint.

Recording must preserve the resource contract:

1. the canonical response body remains unchanged
2. response status and content type remain correct
3. a telemetry failure does not make the resource unavailable
4. actor and optional agent-family classification remain indicative
5. only the allowlisted resource key and normalized request dimensions are
   stored

## Idempotency And Projection Contract

Raw validated events are append-only and keyed by their event ID.

Ingestion and projection share one database transaction:

1. insert an unseen raw event
2. increment the matching daily event count
3. insert a daily session contribution when an anonymous session exists
4. increment the matching daily anonymous-session count only when that
   contribution is new

Consequences:

1. replaying an event ID does not double-count anything
2. repeated events can increase event counts
3. one ephemeral session contributes at most once per day and reporting
   dimension to the anonymous-session count
4. failure rolls back the raw write and aggregate changes together

The same projection must be reproducible by rebuilding from retained raw
events. Rebuild output is the verification oracle for incremental projection.

## Reporting Contract

The initial operator view at `/dashboard/ops/telemetry` supports 7-, 30-, and
90-day windows.

It exposes aggregate product telemetry only:

1. page views
2. ephemeral anonymous sessions
3. actor-class split
4. daily trend
5. top canonical pages
6. normalized referrer sources
7. meaningful intent counts
8. agent-resource and indicative agent-family reach

The same view may read platform lifecycle and runtime usage facts for the
selected window when it labels those as separate evidence sources.

The reporting API is ops-authorized. It does not expand creator-facing game
analytics and does not expose raw telemetry events to the browser.

## Agent Operator Contract

The canonical machine entrypoint is:

```bash
pnpm run repo -- platform telemetry --help
```

The supported lifecycle is:

1. `overview --days <7|30|90> --environment <environment> --json`
2. `health --json`
3. `rebuild [--apply] --json`
4. `retain [--apply] --json`
5. optional `--railway-environment <id>` and `--railway-project <id>` targeting
   on every operation

JSON responses use a top-level contract version, command name, optional applied
flag, and result object. Dates serialize as offset-aware ISO strings.
Machine consumers invoke `pnpm --silent run repo -- ... --json` so the package
runner does not prefix the JSON document with human-oriented script output.

`overview` preserves the same three authority labels as the ops UI. `health`
returns aggregate storage and retention state and never exposes raw telemetry
rows. Rebuild and retention omit mutation by default; only `--apply` authorizes
the operation.

The CLI must call the canonical reporting, projection, and retention domain
services. It must not own alternate SQL, aggregation rules, retention rules, or
privacy behavior.

Hosted targeting must resolve the database credential internally and pass it
only to the bounded telemetry subprocess. It must not print or persist the
credential.

## Retention Contract

The initial retention rules are:

1. raw browser and server-observed events: 90 days
2. daily session contributions: 90 days after their aggregate is stable
3. daily aggregates: retained long-term

Cleanup is an explicit, independently testable operation. Reporting reads must
not perform hidden retention work.

## Required Proof

The implementation must prove:

1. every canonical event is accepted and arbitrary input is rejected
2. classification and normalization are bounded and deterministic
3. origin, fetch-site, JSON, request-size, batch, and time-skew guards work
4. request identity is used only transiently for throttling
5. event replay is idempotent
6. daily anonymous-session contribution is deduplicated by reporting slice
7. rebuilding reproduces incremental aggregates
8. ops authorization protects API and UI
9. all three evidence sources remain visibly distinct
10. navigation, intent actions, and agent-resource routes preserve product
    behavior while recording their canonical events
11. no obsolete third-party website-analytics implementation, environment,
    CSP, or documentation contract remains
