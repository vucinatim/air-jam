# Operational Events And Incidents Contract

Last updated: 2026-08-30
Status: canonical version `1` contract

Related sources:

1. [`@air-jam/operations-contract`](../../packages/operations-contract/index.mjs)
2. [Product Telemetry Contract](./product-telemetry-contract.md)
3. [Production Control Contract](./production-control-contract.md)
4. [Production Observability Baseline](../strategy/production-observability-baseline.md)
5. [Air Jam 1.0 Release Roadmap](../plans/v1-release-roadmap-plan.md)

## Purpose

This contract defines the machine boundary Air Jam uses to move from logs and
symptoms toward correlated incidents and safely governed recovery actions.

It covers:

1. authority separation between product telemetry, lifecycle/runtime facts,
   and operational incidents
2. the versioned operational-event envelope
3. correlation and causation propagation
4. deterministic incident fingerprinting and state
5. runbook descriptors, preview/apply requests, and action audit records
6. privacy, redaction, versioning, and fail-closed behavior

This contract does not claim that the durable outbox, incident store,
notification delivery, GitHub issue bridge, or automatic remediation engine
already exists. Later Gate 4 work implements those systems against this shared
boundary rather than inventing their own event models.

## Canonical Machine Surface

The reusable runtime schemas live in the private workspace package:

```text
@air-jam/operations-contract
```

Agents inspect the same contract through the repository CLI:

```bash
pnpm --silent run repo -- platform operations contract inspect --json
pnpm --silent run repo -- platform operations contract inspect \
  --section incident --json
pnpm --silent run repo -- platform operations contract schema \
  --name runbook_preview --json
pnpm --silent run repo -- platform operations contract validate \
  --schema operational_event --input ./event.json --json
pnpm --silent run repo -- platform operations contract validate \
  --schema runbook --input ./runbook.json --json
```

`--input -` reads JSON from stdin. Validation output contains only schema paths,
codes, and messages. It never echoes the submitted document.

`contract schema` exports Draft 7 JSON Schema for editor, MCP, and agent
discovery. JSON Schema describes the structural wire format. The canonical
runtime validator remains required because chronology, digest binding,
authority, approval, and blast-radius relationships cross multiple fields and
documents.

The supported schema names are:

1. `operational_event`
2. `incident_fingerprint_input`
3. `incident`
4. `runbook`
5. `runbook_preview`
6. `runbook_invocation`
7. `runbook_action`

## Three Authority Planes

Air Jam keeps three planes distinct.

| Plane                 | Authority                                                                   | Valid uses                                                                   | Forbidden uses                                                                 |
| --------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Product telemetry     | Approximate discovery and intent evidence                                   | Aggregate discovery, intent, agent reach, and trend analysis                 | Correctness decisions, billing authority, automatic remediation, confirmation  |
| Lifecycle/runtime     | Air Jam authoritative, provider-attested, synthetic, or operator-attested   | Incident evidence, SLO evaluation, diagnosis, and remediation verification   | Treating untrusted caller claims as authority or retaining secrets in payloads |
| Operational incidents | Durable correlated state derived from acceptable lifecycle/runtime evidence | Deduplication, ownership, notification, runbook selection, issue maintenance | Replacing source evidence or silently granting remediation authority           |

Product telemetry does not become an operational event merely because it looks
anomalous. It may prompt investigation, but correctness-critical action requires
authoritative or attested lifecycle/runtime evidence.

## Operational Event Envelope

Every event uses contract version `1` and the literal plane
`lifecycle_runtime`. Unknown versions and unknown fields fail validation.

Required identity and classification:

1. `eventId`: unique identity for this fact
2. `kind`: lowercase semantic name such as `release.job.failed`
3. `severity`: `debug`, `info`, `warning`, `error`, or `critical`
4. `outcome`: `observed`, `started`, `succeeded`, `failed`, `degraded`,
   `recovered`, `blocked`, or `canceled`
5. `authority`:
   1. `airjam_authoritative`
   2. `provider_attested`
   3. `synthetic_observation`
   4. `operator_attested`

Required source context:

1. service
2. component
3. environment
4. optional process/deployment instance and exact version

Required subject context:

1. subject type
2. opaque subject identity

Required timing:

1. `occurredAt`: when the source says the fact happened
2. `observedAt`: when Air Jam accepted or observed it
3. `observedAt` may not precede `occurredAt`

Payloads are structured JSON bounded to `64 KiB`. Evidence references are
bounded and typed. Large logs, traces, screenshots, archives, and provider
responses stay in their owning stores; the envelope contains a safe reference
and optional SHA-256 digest.

### Source Authority

`airjam_authoritative` is valid only for facts committed by the owning Air Jam
domain boundary, such as a durable job transition or room lifecycle event.

`provider_attested` is valid only when evidence comes from the provider's
authenticated API or signed delivery surface and retains immutable provider
identity.

`synthetic_observation` describes what an executed check observed. A synthetic
may prove a user-visible symptom, but it cannot claim an internal cause it did
not inspect.

`operator_attested` records an explicit human observation or decision with an
opaque operator identity. It must not be synthesized from approximate product
telemetry.

## Correlation And Causation

Every operational event, incident-linked runbook request, and runbook action
contains correlation contract version `1`.

`correlationId` is the root story identifier. It remains stable as a story
crosses process, queue, provider, and agent boundaries.

`causationEventId` identifies the one direct event that caused the new event.
It is not a list of everything related to the incident.

Optional reference fields preserve relevant domain identity:

1. request
2. user-safe session
3. room
4. runtime session
5. controller
6. game
7. release
8. release generation
9. operational job
10. deployment
11. provider operation

Rules:

1. preserve the root `correlationId` across boundaries
2. create a new `eventId` for every new fact
3. set `causationEventId` only to the direct causal event
4. copy only the domain references that are true for the current fact
5. use opaque user-safe identifiers
6. never propagate email, IP address, cookies, authorization headers, tokens,
   or storage credentials as correlation values

Missing optional identity is honest. Fabricated correlation is not.

## Incident Fingerprinting

One confirmed symptom should produce one maintained incident, not one issue per
log line.

Version `1` fingerprints SHA-256 over the exact normalized tuple:

1. contract version
2. environment
3. service
4. symptom kind
5. failure class
6. scope
7. optional scope key

Supported scopes are:

1. `global`
2. `service`
3. `game`
4. `release`
5. `room`

Global fingerprints have no scope key. Every narrower scope requires one.
High-cardinality request, controller, and correlation identifiers do not enter
the fingerprint. They remain evidence attached to the deduplicated incident.

A recurrence after resolution reopens the same fingerprinted incident. A real
change in failure class or scope creates a different fingerprint.

## Incident Record

The version `1` incident record contains:

1. incident identity and deterministic fingerprint input
2. severity and state
3. human-readable title and bounded summary
4. explicit owner or `unassigned`
5. first/last occurrence and count
6. latest source event
7. bounded correlation and evidence references
8. optional active runbook action
9. optional GitHub issue link
10. optimistic revision
11. resolution evidence when resolved

Severity meanings:

| Severity | Meaning                                                                 |
| -------- | ----------------------------------------------------------------------- |
| `sev1`   | Broad outage, data loss risk, security compromise, or uncontrolled cost |
| `sev2`   | Major launch-critical degradation without an adequate fallback          |
| `sev3`   | Bounded degradation or repeated failure with a working fallback         |
| `sev4`   | Low-impact anomaly requiring maintenance rather than interruption       |

Canonical states:

```text
open -> investigating -> mitigating -> monitoring -> resolved
  \          \              \             \
   ------------------------------------------> escalated
resolved -> open  (confirmed recurrence)
```

Transitions fail closed. A resolved incident must contain a resolution code,
summary, time, and resolving actor. A non-resolved incident must not claim a
resolution. The incident schema recalculates the deterministic fingerprint and
rejects records whose fingerprint does not match their fingerprint input.

## Runbook Descriptor

A runbook is a versioned machine action contract, not prose that asks an agent
to improvise shell commands.

Every descriptor defines:

1. stable runbook ID and semantic version
2. title and bounded description
3. authority class
4. mutation class
5. explicit environment/service/resource/cost blast radius
6. maximum attempts, cooldown, and timeout
7. typed non-secret parameters
8. ordered semantic action names
9. verification action for every mutation
10. rollback runbook for bounded automatic recovery

Authority classes:

| Authority           | Meaning                                                        |
| ------------------- | -------------------------------------------------------------- |
| `observe`           | Read-only inspection                                           |
| `recommend`         | Read-only diagnosis and proposed action                        |
| `approval_required` | Apply is allowed only with a retained explicit approval record |
| `bounded_auto`      | Reversible, allowlisted apply inside pre-approved hard limits  |

Mutation classes:

1. `read_only`
2. `reversible`
3. `destructive`

Safety invariants are structural:

1. observe and recommend runbooks are read-only
2. destructive runbooks always require explicit approval
3. bounded automatic runbooks must be reversible
4. bounded automatic runbooks require verification and a rollback runbook
5. bounded automatic runbooks cannot require ad hoc per-run approval because
   their authority comes from the pre-approved descriptor and hard limits
6. every mutation has a verification action
7. attempts never exceed five in contract version `1`

## Preview And Apply

Every invocation supplies:

1. exact runbook ID and version
2. idempotency key
3. actor and reason
4. correlation context
5. optional incident identity
6. bounded non-secret parameters
7. request time

Preview is always read-only. It calculates eligibility, planned semantic
actions, expected blast radius, and before evidence without mutation.

The preview record retains:

1. its creation and expiry window
2. the exact runbook descriptor digest
3. the exact canonical parameter digest
4. incident and root correlation identity
5. actual environments, services, resource references, and estimated cost
6. the exact ordered action IDs
7. before evidence and bounded warnings

Apply must provide both the `previewId` and preview digest. Authorization
re-parses all three documents and rejects a descriptor, parameter, context,
action-order, expiry-window, or blast-radius mismatch. A mutating preview must
contain before evidence. An `approval_required` apply also retains:

1. approving actor
2. approval time
3. immutable decision reference

Only an operator can approve. The approval must occur after preview creation
and no later than the apply request. An invocation for a different runbook
version is rejected. Observe and recommend runbooks cannot be applied, and a
bounded automatic apply must identify an agent or system actor.

## Runbook Action Audit

Every accepted apply creates one durable action record with:

1. action identity
2. exact runbook version
3. preview identity, immutable preview digest, and idempotency identity
4. actor, incident, and correlation
5. attempt count
6. status and timestamps
7. before and after evidence
8. bounded result code, summary, and details
9. optional rollback action identity

Action states are:

```text
scheduled -> running -> succeeded
    |           |  \-> failed -> rolled_back -> escalated
    |           \----> escalated
    \-> rejected
```

Terminal records require a completion time and result. Successful and
rolled-back actions require after evidence, and a rolled-back record names its
rollback action. Timestamp order is validated. Successful actions cannot
silently restart. Failed verification rolls back when the descriptor allows it
and otherwise escalates. The attempt ceiling prevents remediation loops.

## Privacy And Redaction

Operational payloads and validation output must not contain:

1. credentials or tokens
2. cookies or authorization headers
3. raw personal identifiers
4. unredacted provider responses
5. unbounded stack traces
6. full object-store keys when a safe resource reference is sufficient

Errors use stable codes and bounded summaries. Detailed evidence stays in a
restricted owning store and is referenced by opaque ID or digest.

The generic schema cannot recognize every future secret name. Producers remain
responsible for redaction before envelope creation, and persistence/delivery
adapters must apply their own defensive redaction.

## Delivery And Persistence Boundary

The envelope is transport-independent. Producers do not write directly to
GitHub, Slack, email, or an alerting vendor.

The intended flow is:

```text
domain commit -> durable outbox -> delivery lease -> event store/correlator
              -> incident -> notification/issue policy -> runbook authority
```

The future outbox must preserve transaction ownership, idempotency, lease,
retry, and dead-letter semantics without changing this envelope. External
delivery is a replaceable adapter after durable Air Jam state.

## Versioning

Contract version is a positive integer and version `1` is exact. Producers and
consumers fail closed on unknown versions.

Compatible additions require a new optional field only when existing strict
parsers are updated in the same production-valid change. A renamed field,
changed authority meaning, fingerprint tuple change, or state-machine change
requires a new contract version and an explicit migration.

Runbook versions are semantic versions independent of the envelope contract.
Every action binds to the exact descriptor version it evaluated.

## Acceptance Boundary For G4-01

This contract slice is complete when:

1. the shared runtime schemas and deterministic helpers pass their tests
2. the repo CLI discovers, exports, and validates all seven schema families
3. product telemetry cannot validate as an operational event
4. unknown versions, fields, states, and unsafe runbook authority fail closed
5. payload validation output does not echo submitted values
6. the docs and machine catalog describe the same authority and safety model

The next Gate 4 slices implement the durable outbox, SLO/synthetic/error
producers, incident correlation and GitHub delivery, runbook execution/audit,
and failure drills against this boundary.
