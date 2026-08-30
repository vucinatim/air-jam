# Air Jam 1.0 Security Threat Model

Last updated: 2026-08-30
Status: completed `G5-01` audit
Readiness owner: `G5-01`

Related sources:

1. [Air Jam 1.0 Release Roadmap](../../plans/v1-release-roadmap-plan.md)
2. [Platform Identity And Auth Architecture](../../architecture/platform-identity-and-auth-architecture.md)
3. [Production Control Contract](../../contracts/production-control-contract.md)
4. [Operational Events And Incidents Contract](../../contracts/operational-events-and-incidents-contract.md)
5. [Canonicalization Decision Register](../v1-canonicalization/decision-register.md)

## Outcome

Air Jam is not yet safe to declare 1.0-ready.

The audit found one critical architectural boundary failure and thirteen high
priority threat groups. The critical failure is concrete in both source and the
current production configuration: creator-controlled hosted game code falls
back to the authenticated platform origin. A malicious listed game can
therefore execute with the origin authority of `airjam.io` rather than as an
isolated game.

The remaining high-priority threats concern credential destination binding,
host and controller authority, the browser worker, realtime ingress, bounded
resource use, cross-adapter admission, reporter privacy, supply-chain
provenance, mutable agent guidance, data retention, provider operations, and
emergency content control.

This document is the ranked evidence and decision record required by `G5-01`.
It is not a second execution tracker. The canonical readiness manifest retains
all implementation state:

1. `G5-02` owns auth, ownership, secret, limit, abuse, and privileged-endpoint
   closure.
2. `G5-03` owns supply-chain provenance, privacy claims, and emergency-release
   proof.
3. `G5-04` owns one human review of the complete residual-risk batch.
4. Gate 3 owns the durable queues, quotas, cleanup, spend controls, capacity,
   and failure drills required by several security proofs.
5. Gate 4 owns durable evidence, alerts, incidents, and audited remediation.

No critical or high finding may be silently converted into accepted residual
risk. If a public surface cannot meet its proof before 1.0, that surface must be
disabled or deliberately narrowed through a production-valid policy.

## Method And Evidence Boundary

Three independent read-only lanes reviewed the public/artifact,
privileged/agent/provider, and supply-chain/privacy surfaces. Root synthesis
then re-read the high-impact code paths, deduplicated overlapping reports, and
mapped every accepted finding to existing readiness authority.

Evidence came from:

1. source, tests, schemas, workflows, package metadata, and canonical docs
2. `pnpm --silent run repo -- readiness inspect ... --json`
3. the repo-owned Railway doctor and redacted variable-name inspection
4. exact production service and environment identities, without printing
   secret values

The provider inspection observed on 2026-08-30 that:

1. the production platform, realtime server, release browser worker, and
   PostgreSQL services had successful deployments
2. production browser-worker credentials were present on both the platform and
   worker services
3. the platform had its auth, internal release, database, and R2 credential
   variables present
4. no dedicated hosted-release public base URL variable was present, so the
   source-level fallback to the platform site remains the current production
   configuration

Presence does not prove credential strength, equality, rotation, network
isolation, or absence from logs. Those remain explicit proof requirements.

## Ranking

Priority and release classification are intentionally separate:

| Priority | Meaning                                                                                              | 1.0 treatment                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `P0`     | Critical authority failure, account compromise, data-loss path, or uncontrolled privileged execution | Must be fixed and adversarially proven before 1.0                                                        |
| `P1`     | High-likelihood or high-impact public, cost, privacy, availability, or supply-chain failure          | Must be fixed, or the affected public capability must be production-validly disabled/narrowed before 1.0 |
| `P2`     | Important defense-in-depth or operator-integrity gap with bounded current exposure                   | May reach `G5-04` only with explicit evidence and residual-risk review                                   |
| `P3`     | Localized hygiene whose deferral does not weaken the stated 1.0 contract                             | Post-1.0 only with a durable rationale                                                                   |

Confidence is `high` when source directly establishes the behavior, `medium`
when exploitability also depends on deployment or caller behavior, and `low`
only when the audit has indirect evidence. This audit contains no accepted low-
confidence launch blocker.

## Protected Assets

1. browser, OAuth, machine, host, controller, and operator credentials
2. creator ownership and release-publication authority
3. operator quarantine, provider, deployment, database, storage, and package
   authority
4. active room identity, master-host ownership, controller identity, state, and
   gameplay availability
5. creator artifacts, managed media, public listings, and moderation evidence
6. release-worker compute and its provider/private-network reach
7. production database, object storage, monthly infrastructure budget, and
   launch capacity
8. npm package bytes, GitHub workflow identity, provenance, tags, and releases
9. agent-facing instructions, local workspaces, environment values, and token
   stores
10. reporter contact, account/session data, product telemetry, runtime telemetry,
    and deletion/retention promises
11. canonical readiness evidence and human release approvals

## Credible Attackers

1. unauthenticated internet clients and automated bots
2. low-cost or sybil creator accounts
3. a malicious or compromised game creator and artifact
4. a room-code holder or raw Socket.IO client capable of setting arbitrary
   headers and payloads
5. a stolen machine-token holder
6. malicious project files, game metadata, logs, or agent instructions consumed
   by a privileged coding agent
7. a compromised npm dependency, GitHub Action, CDN, hosted AI-pack origin, or
   maintainer workstation
8. accidental or malicious provider misconfiguration

## Trust-Boundary Map

| Boundary                                  | Untrusted side                                         | Protected side                                                     | Required invariant                                                                                   | Primary owners                                      |
| ----------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Public web to platform                    | anonymous browser, bot, raw HTTP client                | auth, database, reports, catalog, telemetry                        | strict validation, trusted request identity, bounded admission, no ambient privilege                 | Platform / `G5-02`, Gate 3                          |
| Creator to release pipeline               | ZIP/media metadata and bytes                           | R2, validator, browser worker, moderation, public catalog          | bounded immutable generations, decoded validation, cleanup, quarantine                               | Release platform / `G5-02`, Gate 3                  |
| Hosted game to platform shell             | creator HTML/JS/CSS                                    | cookies, DOM, authenticated APIs, navigation                       | distinct cookieless origin, sandbox, narrow bridge and permissions                                   | Runtime + release delivery / `G5-02`                |
| Platform to browser worker                | moderation job and inspection token                    | remote Chromium and provider network                               | fail-closed auth, scoped header, bounded use, denied private egress                                  | Browser worker / `G5-02`                            |
| Host/controller to realtime               | app ID, grant, room code, capability, arbitrary events | room authority, state, lifecycle, other players                    | single-use scoped grants, leases, least privilege, validated bounded ingress                         | Realtime + SDK / `G5-02`                            |
| Browser device approval to machine client | user code and public polling                           | 30-day account bearer                                              | issuer/client/scopes binding, one-time grant, throttling, revocation                                 | Platform auth + devtools / `G5-02`                  |
| Agent/project to local tools              | config, metadata, logs, symlinks, prompt-like text     | local files, environment, machine credentials, publish/reset tools | untrusted-data labeling, sandboxed evaluation, destination binding, explicit destructive annotations | CLI + MCP / `G5-02`                                 |
| Repo CLI to provider                      | endpoint, project/env/service IDs, mutation request    | Railway bearer, production secrets and services                    | fixed endpoint, redaction, immutable preview/apply, exact-target approval                            | Repo operations / `G5-02`, Gate 4                   |
| GitHub to npm                             | source, dependencies, actions, workflow artifacts      | OIDC publisher and public package identity                         | least privilege, immutable dependencies, build-once publish-exact bytes, provenance                  | Release engineering / `G5-03`, Gates 6–7            |
| Hosted AI pack to creator repo            | mutable manifest and text                              | agent instructions and project files                               | signed metadata, rollback protection, bounded atomic update                                          | CLI + public release / `G5-03`                      |
| Telemetry/reporting to storage and views  | public events, reporter contact, runtime payloads      | privacy promises and operator evidence                             | minimization, ops-only contact, fixed schemas, enforced retention/delete                             | Platform data + trust and safety / `G5-02`, `G5-03` |

## Required Global Invariants

The detailed findings below reduce to these non-negotiable rules:

1. creator-controlled executable bytes never share authenticated platform
   origin authority
2. a bearer credential is never sent to an issuer or audience it was not bound
   to
3. public identifiers, `Origin`, app IDs, and room codes are routing context,
   not privileged authority
4. every privileged session and capability is scoped, expiring, revocable, and
   least-privileged
5. every public or authenticated cost-producing adapter shares one semantic,
   durable admission policy
6. expensive work is queued, bounded, idempotent, immutable until promotion,
   and reconciled after failure
7. remote browser execution is authenticated, sandboxed, quota-bound, and
   denied access to private/provider networks
8. provider and release mutations use inspect, immutable preview, exact apply,
   audit, and explicit production approval
9. public package and agent-guidance bytes are bound to immutable reviewed
   provenance
10. privacy claims are enforced by projections, scheduled retention, deletion,
    and production evidence rather than prose alone

## Ranked Register

| ID           | Priority | Threat                                                                           | Release class | Confidence | Readiness owner           |
| ------------ | -------- | -------------------------------------------------------------------------------- | ------------- | ---------- | ------------------------- |
| `AJ-SEC-001` | P0       | Untrusted hosted games execute with authenticated platform-origin authority      | blocks-1.0    | high       | `G5-02`, Gate 3           |
| `AJ-SEC-002` | P1       | Stored machine bearers can cross to a caller-selected issuer                     | blocks-1.0    | high       | `G5-02`                   |
| `AJ-SEC-003` | P1       | Public/replayable host grants can replace room master authority                  | blocks-1.0    | high       | `G5-02`                   |
| `AJ-SEC-004` | P1       | Browser worker can fail open and gives untrusted pages privileged egress         | blocks-1.0    | high       | `G5-02`                   |
| `AJ-SEC-005` | P1       | Room code and optional controller capability grant excessive authority           | blocks-1.0    | high       | `G5-02`                   |
| `AJ-SEC-006` | P1       | Malformed, deep, oversized, or high-rate realtime input can deny service         | blocks-1.0    | high       | `G5-02`, `G3-04`          |
| `AJ-SEC-007` | P1       | Release/media work can exceed memory, storage, cleanup, and atomicity bounds     | blocks-1.0    | high       | `G5-02`, `G3-02`–`G3-04`  |
| `AJ-SEC-008` | P1       | Process-local and adapter-specific admission permits cost and abuse bypass       | blocks-1.0    | high       | `G5-02`, `G3-02`, `G3-04` |
| `AJ-SEC-009` | P1       | Reporter identity leaks to creators while public report intake is unbounded      | blocks-1.0    | high       | `G5-02`, `G5-03`          |
| `AJ-SEC-010` | P1       | npm publication does not publish one immutable previously validated artifact     | blocks-1.0    | high       | `G5-03`, `G6-01`, Gate 7  |
| `AJ-SEC-011` | P1       | Mutable unsigned AI-pack origin can rewrite agent-facing project guidance        | blocks-1.0    | high       | `G5-02`, `G5-03`          |
| `AJ-SEC-012` | P1       | Telemetry, session, OAuth, and account retention/privacy are not fully enforced  | blocks-1.0    | high       | `G5-02`, `G5-03`, Gate 3  |
| `AJ-SEC-013` | P1       | Auth and provider tooling can fail open, redirect credentials, or expose secrets | blocks-1.0    | high       | `G5-02`, Gate 4           |
| `AJ-SEC-014` | P1       | Screenshot-only moderation and incomplete takedown permit evasive hosted abuse   | blocks-1.0    | medium     | `G5-02`, `G5-03`, Gate 7  |
| `AJ-SEC-015` | P2       | Privileged mutations lack complete step-up, replay, and actor-audit proof        | before-scale  | high       | `G5-02`, Gate 4           |
| `AJ-SEC-016` | P2       | Readiness and release evidence are declarative rather than authenticated         | before-scale  | high       | `G5-02`, `G5-03`, `G5-04` |
| `AJ-SEC-017` | P2       | Scaffold extraction and installation lack final generic resource budgets         | before-scale  | high       | `G5-03`, `G6-01`          |

## Detailed Findings

### AJ-SEC-001 — Untrusted hosted games execute with authenticated platform-origin authority

- Category: boundary
- Priority: P0
- Severity: critical
- Release classification: blocks-1.0
- Confidence: high
- Closure status (2026-08-30): implementation in progress under `G5-02`. The
  current stacked change removes the same-origin fallback, requires a separate
  cookie site, gates incoming Host authority and route execution, separates
  response policy, applies one sandbox contract to host/controller frames, and
  exposes a machine-readable operator assessment. Local unit, real-Next-server
  Host-routing, and hostile-browser proofs pass. A bounded repo-CLI attestation
  now pins DNS, validates TLS, checks exact host and controller documents,
  representative protected API CORS, stable deployment-reported identity, and
  the exact Railway project/current deployment/both-domain binding without
  executing creator code locally. The finding remains open until the dedicated
  production origin is provisioned, that deployed attestation is eligible, and
  the controlled hostile-browser plus normal host/controller proof set is
  retained. Arbitrary deployed browser execution is intentionally deferred to
  the hardened `AJ-SEC-004` worker boundary rather than performed unsandboxed on
  a maintainer machine.
- Evidence at audit time:
  - `apps/platform/src/server/releases/release-public-url.ts:8-12` falls back
    to the platform site when no release base URL is configured.
  - `apps/platform/src/app/releases/g/[gameId]/r/[releaseId]/[[...assetPath]]/route.ts:103-170`
    returns creator-controlled HTML, JavaScript, CSS, and other bytes.
  - `apps/platform/src/components/arcade/game-player.tsx:667-695` loads the host
    iframe without a sandbox.
  - `apps/platform/src/app/controller/controller-game-frame.tsx:27-36`
    combines `allow-scripts` and `allow-same-origin` with broad popup/form
    permissions.
  - `apps/platform/next.config.ts:45-88` defines a platform CSP that permits
    inline/eval scripts and broad HTTPS connections; it is not a containment
    policy for untrusted games.
  - read-only Railway variable-name inspection found no dedicated hosted-
    release base URL in production on 2026-08-30.
- Current controls: release ownership and status checks, artifact path
  normalization, fail-closed screenshot moderation, scoped private-inspection
  tokens, and bridge source/origin/capability validation.
- Threat and harm: a malicious listed game opened by a logged-in creator or
  operator can directly use the platform origin to read DOM/storage and call
  authenticated platform endpoints. Bridge validation cannot constrain direct
  same-origin access. The device approval flow provides one concrete confused-
  deputy route to mint a machine session under the victim account.
- Canonical end state: serve all creator executable bytes from a dedicated
  cookieless origin, preferably a different registrable domain. The platform
  must fail startup or publication when the configured untrusted origin equals
  any authenticated platform origin. Host and controller frames use the
  smallest sandbox and Permissions Policy compatible with the explicit bridge.
- Owner and dependencies: platform release delivery and runtime embedding;
  `G5-02`, coordinated with Gate 3 immutable/static delivery.
- Required proof:
  1. a production configuration assertion proves origin separation and absence
     of platform cookies/auth CORS on the untrusted domain
  2. route-specific CSP, `frame-ancestors`, navigation, popup, connect, and
     Permissions Policy are explicit
  3. a malicious-release browser fixture cannot read parent DOM, cookies,
     storage, dashboard APIs, or device approval/poll endpoints, cannot escape
     or navigate the top frame, and cannot beacon outside the declared policy
  4. normal host/controller bridges, audio, input, state, and fullscreen remain
     functional

### AJ-SEC-002 — Stored machine bearers can cross to a caller-selected issuer

- Category: agent-operability
- Priority: P1
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `packages/devtools-core/src/platform-auth.ts:133-155,199-217,310-332`
  stores tokens securely on disk but can reuse one while accepting a different
  supplied base URL; `packages/mcp-server/src/tools.ts:122-124,335-410` exposes
  that URL through machine release operations; machine sessions live for 30
  days in `apps/platform/src/server/auth/machine-session.ts:13,88-105`.
- Current controls: private token directory/file modes, atomic file replacement,
  bearer expiry, revocation, and server-side ownership checks.
- Threat and harm: malicious repository text or tool arguments can persuade an
  agent to send a valid broad bearer to an attacker server.
- Canonical end state: persist and validate the token issuer/audience with the
  token. Never send a stored credential to a different origin. Alternate
  origins require an explicit separate login and token. HTTPS is mandatory
  except for an explicit loopback development boundary. Machine authority is
  scoped, short-lived, refreshable, revocable, and inspectable.
- Owner and dependencies: CLI, MCP, platform machine auth; `G5-02`.
- Required proof: an attacker HTTP server receives zero authorization bytes;
  issuer mismatch and insecure non-loopback URL tests fail closed; scope,
  expiry, rotation, revocation, and session-inventory tests pass.

### AJ-SEC-003 — Public/replayable host grants can replace room master authority

- Category: authority
- Priority: P1
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence:
  - `apps/platform/src/app/api/airjam/host-grant/route.ts:10-47` is public and
    validates `Origin` only when present.
  - `packages/sdk/src/protocol/host-grant.ts:5-12,137-181` grants have no
    single-use ID, audience, session kind, or room/launch intent.
  - `packages/server/src/gateway/handlers/register-host-lifecycle-handlers.ts:478-512`
    accepts a caller-selected room and replaces `masterHostSocketId` without a
    server-issued reconnect lease.
- Current controls: signed 60-second grants, scope/origin verification,
  production auth fail-closed behavior, and socket lifecycle rate limits.
- Threat and harm: raw clients can omit or forge `Origin`, replay a grant, and
  attempt to bind or replace privileged host authority for a live room.
- Canonical end state: host-grant issuance has a non-forgeable abuse identity;
  claims bind `jti`, audience, session kind, and launch/room intent; the server
  consumes them atomically once. An active master host can be replaced only
  with a server-issued reconnect/lease capability.
- Owner and dependencies: platform host auth, SDK protocol, realtime lifecycle;
  `G5-02`.
- Required proof: raw-client tests reject missing/forged origin, replay,
  arbitrary-room registration, and active-room hijack while legitimate first
  launch and reconnect remain functional.

### AJ-SEC-004 — Browser worker can fail open and gives untrusted pages privileged egress

- Category: boundary
- Priority: P1
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence:
  - `packages/release-browser-worker/src/access-control.ts:18-30` authorizes all
    requests when the token is absent.
  - `packages/release-browser-worker/src/env.ts:36-80` makes the token optional,
    binds `0.0.0.0`, and defaults Chromium sandboxing off.
  - `packages/release-browser-worker/src/index.ts:62-82,107-176` exposes the
    Playwright WebSocket after that check.
  - `apps/platform/src/server/releases/release-screenshot-service.ts:45-80`
    loads creator HTML with unrestricted context egress and a context-wide
    inspection header.
  - production currently has worker/client token variables present, which
    limits the claim to a fail-open architecture and unproven egress rather
    than a confirmed anonymous production worker.
- Current controls: bearer enforcement when configured, a scoped/expiring HMAC
  release inspection token, and a loopback internal browser listener.
- Threat and harm: one missing variable exposes a public remote browser;
  malicious game code can probe loopback, private/provider networks, metadata
  endpoints, redirects, DNS rebinding, or WebSockets. A context-global header
  can leak the inspection token cross-origin.
- Canonical end state: non-local worker startup requires a strong token and a
  supported sandboxed/non-root execution profile; remote auth and quotas fail
  closed; private/link-local/metadata egress is denied at browser and network
  layers; inspection authorization is attached only to the exact release
  origin.
- Owner and dependencies: browser worker and provider infrastructure; `G5-02`,
  with Gate 3 resource bounds and Gate 4 health/rotation operations.
- Required proof: missing-token startup failure; unauthorized HTTP/WS tests;
  per-client connection/context/page/time limits; hostile fixtures for private
  IPs, provider DNS, metadata, redirects, DNS rebinding, and WS; scanner
  evidence; non-root/sandbox/seccomp attestation; token rotation and
  Chromium-aware readiness through the repo CLI.

### AJ-SEC-005 — Room code and optional controller capability grant excessive authority

- Category: authority
- Priority: P1
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence:
  - room IDs contain about 20 bits of entropy in
    `packages/server/src/utils/ids.ts:4-16`
  - controller capability is optional in
    `packages/sdk/src/protocol/controller.ts:76`
  - `packages/server/src/gateway/handlers/register-controller-handlers.ts:250-336`
    grants the default privilege set when capability/session authority is absent
  - defaults include `system`, `play_sound`, and `action_rpc` in
    `packages/server/src/domain/room-session-domain.ts:154-180`
  - manual code entry deliberately omits the generated capability in
    `apps/platform/src/components/controller-menu-sheet.tsx:257`
- Current controls: secure randomness, join throttling and capacity, UUID
  capability URLs, socket/room/controller binding, and invalid supplied-token
  rejection.
- Threat and harm: knowledge or brute-force discovery of a short room code is
  effectively a bearer for privileged controller events.
- Canonical end state: routing codes and privilege capabilities are distinct.
  Missing capability either rejects the join or receives a deliberately narrow
  unprivileged grant set. Manual entry uses host approval or a stronger join
  secret. Capabilities expire, rotate, and reconnect safely.
- Owner and dependencies: SDK and realtime controller authorization; `G5-02`.
- Required proof: negative tests for every privileged event without the proper
  capability, plus brute-force/rate, expiry, rotation, reconnect, manual-entry,
  and host-revocation tests.

### AJ-SEC-006 — Malformed, deep, oversized, or high-rate realtime input can deny service

- Category: availability
- Priority: P1
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence:
  - several event paths destructure or dereference without central runtime
    validation in
    `packages/server/src/gateway/handlers/register-realtime-handlers.ts:582-742`
    and
    `packages/server/src/gateway/handlers/register-host-lifecycle-handlers.ts:1673`
  - arbitrary nested records are accepted in
    `packages/sdk/src/protocol/controller.ts:6` and
    `packages/sdk/src/protocol/sync.ts:87`
  - Socket.IO has no explicit maximum HTTP buffer in
    `packages/server/src/index.ts:243`
  - high-frequency action, input, sync, and retained-state lanes lack one
    complete byte/rate/backpressure policy
- Current controls: Zod on some ingress, lifecycle/join throttling, room
  capacity, and spoofed action-RPC security tests.
- Threat and harm: null/scalar payloads can crash handlers; deep/large records,
  retained state, and high-rate events can monopolize process memory/CPU or
  degrade unrelated rooms.
- Canonical end state: every socket event has one shared schema and bounded
  serialized byte, depth, key, domain, and frequency rules; backpressure and
  disconnect behavior are explicit and observable.
- Owner and dependencies: realtime server and SDK protocol; `G5-02`, proven
  under `G3-04`.
- Required proof: generated/fuzzed null, scalar, deep, oversized, malformed,
  and high-rate payloads across every event; process health and healthy-room
  SLOs remain inside the declared launch envelope.

### AJ-SEC-007 — Release/media work can exceed memory, storage, cleanup, and atomicity bounds

- Category: availability
- Priority: P1
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence:
  - good ZIP bounds exist in
    `apps/platform/src/lib/releases/release-policy.ts:3-9` and traversal,
    symlink, file-count, per-file, and extracted-size validation exists in
    `apps/platform/src/server/releases/release-artifact-validation.ts:51-158,361-502`
  - presigned PUT does not enforce size at the storage edge in
    `apps/platform/src/server/releases/release-storage-r2.ts:126-151`
  - finalization buffers the archive, deletes an extracted prefix, then uploads
    buffered files in the request path at
    `apps/platform/src/server/releases/release-artifact-service.ts:289-415`
  - rejected/abandoned release objects and archived media lack a complete
    physical deletion/reconciliation lifecycle
  - media finalization trusts declared metadata before hashing but does not
    decode/sniff the actual image/video format in
    `apps/platform/src/server/media/game-media-service.ts:71-223`
- Current controls: strict archive validation, content hash, compare-and-set
  state transitions, limited media MIME/extension sets excluding active SVG and
  HTML, and fail-closed moderation.
- Threat and harm: concurrent maximum uploads can impose unbounded memory,
  storage, browser, and moderation cost. A crash after prefix deletion can
  expose a partial/empty generation. Metadata-confused or corrupt media can be
  served, and archived/rejected bytes can accumulate indefinitely.
- Canonical end state: storage-edge size enforcement; durable bounded jobs;
  streamed validation; immutable digest-keyed generations; atomic pointer
  promotion only after complete validation; decoded/transcoded media; exact
  cleanup and reconciliation for rejected, abandoned, replaced, quarantined,
  and archived objects.
- Owner and dependencies: release/media platform; `G5-02`, `G3-02` through
  `G3-04`.
- Required proof: concurrent maximum-artifact and quota-race tests demonstrate
  fixed memory/CPU/storage/browser bounds, crash-safe replay, exact cleanup,
  immutable serving, rollback, and no orphan drift.

### AJ-SEC-008 — Process-local and adapter-specific admission permits cost and abuse bypass

- Category: abuse
- Priority: P1
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence:
  - `apps/platform/src/server/api/rate-limit.ts:1-95` is process-local
  - `apps/platform/src/server/api/trpc.ts:11-20` trusts the first
    `x-forwarded-for` value without a declared trusted-proxy boundary
  - only selected tRPC mutations use rate middleware; public reports,
    device-start/poll, catalog reads, finalization, publishing, and several
    machine routes do not share one semantic admission policy
  - email/password signup is enabled in `apps/platform/src/lib/auth.ts:12-47`
    without a complete verified-account/reputation gate before cost-producing
    work
- Current controls: endpoint-specific limits, bounded telemetry batches,
  archive/media per-file limits, room capacity and realtime lifecycle quotas,
  and the ratified monthly cost policy.
- Threat and harm: multi-instance limits multiply, spoofed proxy identity or
  sybil accounts bypass local buckets, and UI/machine/internal adapters can
  externalize database, storage, moderation, browser, and compute cost.
- Canonical end state: one domain admission service is used by UI, machine
  HTTP, CLI/MCP, public, and internal-job adapters. It derives trusted request,
  account, game, provider, and global identity and owns concurrency, storage,
  work, and spend limits with shadow/enforced modes and kill switches.
- Owner and dependencies: platform and runtime cost controls; `G5-02`, `G3-02`,
  `G3-04`.
- Required proof: restart and multi-instance tests, proxy spoof tests, sybil and
  concurrent-client cases, account/game/global quota races, machine-readable
  usage/reset/BYOC status, spend ceiling, safe degradation, and operator kill
  switch evidence.

### AJ-SEC-009 — Reporter identity leaks to creators while public report intake is unbounded

- Category: privacy
- Priority: P1
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence:
  - public reports accept email in
    `apps/platform/src/server/api/routers/release.ts:46-52,173-192` with no
    shared rate, deduplication, or spam boundary
  - machine projections retain `reporterEmail` in
    `apps/platform/src/server/releases/machine-release.ts:48-67`
  - creator UI renders the email in
    `apps/platform/src/components/releases/release-detail-panels.tsx:150-178`
- Current controls: bounded field lengths, email syntax validation, initial
  open status, and operator quarantine.
- Threat and harm: the reported creator receives reporter contact, enabling
  retaliation and violating a reasonable confidentiality expectation; bots can
  create database and operator-workload spam.
- Canonical end state: contact is an ops-confidential field excluded from all
  creator, CLI, MCP, and public projections. Intake provides clear consent and
  disclosure, distributed throttling, deduplication/spam controls, review and
  retention lifecycle, and one private machine-operable trust-and-safety path.
- Owner and dependencies: trust and safety, release projections, privacy;
  `G5-02`, with disclosure/retention proof in `G5-03`.
- Required proof: projection tests prove creator/public/machine invisibility and
  ops-only access; spam, dedupe, review, resolution, retention, quarantine, and
  audit tests pass through UI and canonical CLI boundaries.

### AJ-SEC-010 — npm publication does not publish one immutable previously validated artifact

- Category: supply-chain
- Priority: P1
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence:
  - `.github/workflows/publish-packages.yml:88-236` grants OIDC/release
    authority around dependency installation, installs mutable `npm@latest`,
    rebuilds packages, and publishes with `--no-git-checks`
  - workflow actions use mutable major tags rather than full commit SHAs
  - `.github/workflows/preview-comment.yml:7-18,62-70` places a Railway token in
    a job that invokes a mutable third-party action
  - the existing isolated-registry proof binds local tarballs but explicitly
    does not prove the real npm registry or complete OS matrix
- Current controls: frozen pnpm lockfile, package graph/version guards, trusted
  npm publishing with provenance, concurrency, already-published
  reconciliation, and SHA-512 local candidate proof.
- Threat and harm: a compromised install dependency/action or mutable tool can
  run in a credentialed job; the bytes tested are not necessarily the bytes
  rebuilt and published.
- Canonical end state: SHA-pin actions and tools; use minimum step/job
  permissions; build, test, pack, hash, SBOM, license-check, and vulnerability-
  check once; publish only that immutable workflow artifact under a protected
  environment; attest exact commit/workflow/artifact identity.
- Owner and dependencies: release engineering; `G5-03`, `G6-01`, Gate 7.
- Required proof: adversarial credential-isolation workflow, provenance/SBOM
  verification, exact SHA-512 equality from tested tarball through npm, real-
  registry install on the support matrix, and rehearsed revoke/deprecate/
  emergency release procedure.

### AJ-SEC-011 — Mutable unsigned AI-pack origin can rewrite agent-facing project guidance

- Category: supply-chain
- Priority: P1
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence:
  - `scripts/platform/lib/platform-ai-pack-artifacts.mjs:85-194` generates a
    manifest and hashes from the same authority without an independent
    signature
  - `packages/cli/src/ai-pack.ts:163-319,641-688` fetches mutable manifest/text,
    permits local URL override/fallback, lacks complete schema/timeout/byte
    bounds, and writes before a trust-anchor verification
- Current controls: SHA-256 content comparison, same-version overwrite refusal,
  managed-file-only replacement, and a packaged fallback.
- Threat and harm: compromise of the platform/CDN or a local manifest override
  can distribute internally consistent malicious instructions to privileged
  creator agents. Hashes from the compromised origin do not establish trust.
- Canonical end state: signed, versioned, expiring root metadata anchored to an
  offline or provenance-bound key; default host allowlist; strict schemas and
  byte/count limits; rollback protection; pre-write verification; staged atomic
  apply and recovery.
- Owner and dependencies: CLI, public docs/AI-pack release; `G5-02`, `G5-03`.
- Required proof: wrong signature, expired/rolled-back metadata, redirect,
  private host, traversal, oversized content, partial download, interrupted
  update, and rollback tests.

### AJ-SEC-012 — Telemetry, session, OAuth, and account retention/privacy are not fully enforced

- Category: privacy
- Priority: P1
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence:
  - product telemetry has strong request minimization and a documented 90-day
    raw retention policy, but retention remains a callable operation rather
    than a proven scheduled invariant in
    `apps/platform/src/server/product-telemetry/persistence.ts:183-270`
  - runtime analytics retain room/app/origin identity and arbitrary payloads in
    `packages/database-contract/src/index.ts:35-208` and
    `packages/server/src/analytics/runtime-usage.ts:8-31`
  - platform sessions store IP and full user agent, while account rows may
    retain OAuth access/refresh/ID tokens in
    `apps/platform/src/db/schema.ts:47-87`
  - no complete account export/delete, token minimization/encryption, runtime
    retention, or restore-boundary deletion proof was found
- Current controls: minimized first-party product telemetry, bounded same-origin
  ingestion, no raw product-telemetry IP/full URL/query/email/fingerprinting,
  deterministic projections, CLI retention preview/apply, and ordinary session
  expiry fields.
- Threat and harm: documented retention can silently become indefinite;
  arbitrary runtime payloads and reusable provider/session data can outlive
  their purpose; account deletion and privacy claims cannot be proven.
- Canonical end state: approved field classification and fixed runtime payload
  schemas; minimum pseudonym lifetime; raw/segment/aggregate retention;
  scheduled cleanup with health/alerts; OAuth token minimization and encryption
  where storage is required; account export/delete across DB, R2, reports,
  media, and telemetry with explicit backup/restore semantics.
- Owner and dependencies: platform data, auth, runtime analytics; `G5-02`,
  `G5-03`, Gate 3/4 operations.
- Required proof: production expiry drill, cleanup last-success and eligible-row
  alerts, seeded account export/delete and restore-boundary test, retention
  conformance, bounded analytics queue/load test, and user-facing privacy
  disclosure matching implementation.

### AJ-SEC-013 — Auth and provider tooling can fail open, redirect credentials, or expose secrets

- Category: privileged-endpoint
- Priority: P1
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence:
  - `apps/platform/src/lib/auth-secret.ts:17-34` can return no secret in
    non-preview production and derives predictable preview secrets from
    environment names
  - public device start/poll routes have no shared durable limiter, while
    `apps/platform/src/server/auth/machine-device-flow.ts:13-16,153-238` uses a
    ten-minute public grant to mint a 30-day machine session
  - `scripts/repo/lib/railway-api.mjs:14-47,76-110` accepts an environment-
    selected API endpoint before sending provider bearer authority
  - `scripts/repo/commands/railway.mjs:281-410` can print rendered variables and
    perform deletion/replacement without one immutable preview/apply contract
- Current controls: authenticated device approval, secure random codes,
  expiries, local `0600` token storage, current production auth/token variable
  presence, explicit provider IDs, and no-deploy-by-default variable mutation.
- Threat and harm: missing auth configuration can degrade unpredictably;
  predictable preview secrets weaken isolation; a malicious endpoint can
  receive Railway credentials; agents can accidentally emit all rendered
  secrets; broad provider mutations are insufficiently guarded for autonomous
  operation.
- Canonical end state: production/preview auth fails startup without
  cryptographically random provider-managed secrets unique per environment;
  device auth is throttled, client/scope-bound, one-time, hashed at rest,
  rotatable and inspectable; Railway endpoint is fixed/allowlisted; secret
  reads are redacted by default; every mutation uses exact-target inspect,
  immutable preview digest, apply, idempotency, audit, and explicit production
  approval.
- Owner and dependencies: platform auth and repo/provider operations; `G5-02`,
  with Gate 4 operational controls.
- Required proof: startup/config tests; preview/prod cookie, machine-token and
  grant mutual rejection; brute-force/phishing/replay/concurrent-poll tests;
  fake-endpoint receives zero bearer bytes; redaction tests; exact target,
  preview/apply, production approval, rollback, and audit tests.

### AJ-SEC-014 — Screenshot-only moderation and incomplete takedown permit evasive hosted abuse

- Category: abuse
- Priority: P1
- Severity: high
- Release classification: blocks-1.0
- Confidence: medium
- Evidence:
  - `apps/platform/src/server/releases/release-moderation-service.ts:96-264`
    primarily evaluates one browser screenshot and image moderation
  - delayed interaction, controller-only routes, alternate paths, phishing,
    malware-like behavior, and outbound network behavior are not comprehensively
    evaluated
  - emergency quarantine exists, but complete immutable decision, CDN/serving
    removal, operator workflow, and notification proof is absent
- Current controls: strict ZIP validation, fail-closed moderation dependency,
  OpenAI image moderation, quarantine, public reports, and operator role checks.
- Threat and harm: malicious content can defer its payload, target only
  controllers, vary by route/time/user, or abuse networking after passing one
  screenshot.
- Canonical end state: one explicit hosted-content/listing policy; static and
  behavioral checks appropriate to the promise; immutable moderation evidence;
  agent-operable quarantine/suspend/takedown; public listing may require ops
  approval for 1.0 if automation cannot honestly cover executable behavior.
- Owner and dependencies: trust and safety and release operations; `G5-02`,
  `G5-03`, Gate 7.
- Required proof: evasive host/controller/multi-route fixtures; delayed and
  outbound behavior checks; moderation decision audit; emergency drill proving
  exact removal from serving/caches, restoration rules, and user/operator
  communication.

### AJ-SEC-015 — Privileged mutations lack complete step-up, replay, and actor-audit proof

- Category: privileged-endpoint
- Priority: P2
- Severity: medium
- Release classification: before-scale
- Confidence: high
- Evidence: ops role is correctly revalidated in
  `apps/platform/src/server/api/trpc.ts:22-39,58-78`, but live quarantine is a
  direct UI mutation and
  `apps/platform/src/server/releases/release-status-service.ts:6-55` does not
  itself retain complete actor, reason, before/after, idempotency, replay, and
  step-up evidence.
- Current controls: database-backed ops role, application-service ownership,
  status-transition rules, and the Gate 4 operational action contract.
- Threat and harm: stolen/stale ops session, double click, retry, or concurrent
  operator action can mutate public content without a complete durable story.
- Canonical end state: sensitive mutations use step-up/explicit confirmation,
  idempotency and concurrency guards, and tamper-resistant events containing
  actor/session, target, reason, before/after, correlation, and outcome.
- Owner and dependencies: platform ops and Gate 4 event/runbook implementation;
  `G5-02`, Gate 4.
- Required proof: stolen/stale session, replay, concurrency, audit-integrity,
  step-up, and rollback tests.

### AJ-SEC-016 — Readiness and release evidence are declarative rather than authenticated

- Category: supply-chain
- Priority: P2
- Severity: medium
- Release classification: before-scale
- Confidence: high
- Evidence:
  - `scripts/repo/lib/readiness-program.mjs:646-705` compares caller-supplied
    owner text and accepts command/decision evidence as strings while only
    artifact/document references receive substantive verification
  - `scripts/repo/commands/release.mjs:34-92` dispatches/tag operations without
    one immutable preview and protected approval binding
- Current controls: dependency-aware manifest, ownership lock, typed evidence
  references, immutable Git evidence, clean-tree checks in several release
  paths, and explicit human checkpoint items.
- Threat and harm: a local process can claim an owner or command decision that
  was not independently authenticated; release authority can outrun reviewed
  evidence.
- Canonical end state: approvals are durable identities from protected
  GitHub/environment authority; command evidence records executable, args,
  exit, timestamp, commit, and artifact digest and is verifier-checked; tag/
  dispatch requires exact clean commit, immutable preview, and production
  approval.
- Owner and dependencies: repo operating system and release engineering;
  `G5-02`, `G5-03`, final review in `G5-04`.
- Required proof: forged owner/decision/command evidence fails; protected
  approval identity and exact artifact/commit binding survive independent
  verification and replay.

### AJ-SEC-017 — Scaffold extraction and installation lack final generic resource budgets

- Category: supply-chain
- Priority: P2
- Severity: medium
- Release classification: before-scale
- Confidence: high
- Evidence:
  - `packages/create-airjam/src/scaffold.ts:310-398` rejects traversal and
    absolute paths but has no generic total extracted bytes, file count, or
    compression-ratio budget
  - `packages/create-airjam/src/scaffold-command.ts:267-304` performs an ordinary
    package-manager install
  - the current candidate `create-airjam` tarball is approximately 87 MB because
    it embeds six scaffold archives
- Current controls: archives are bundled in the trusted package, entry paths
  are validated, the exact local package graph has SHA-512 clean-room proof,
  and generated projects pass quality gates.
- Threat and harm: after a supply-chain compromise or future scaffold growth,
  extraction/install can consume surprising disk, time, or dependency surface.
- Canonical end state: generic extraction budgets and deterministic package/
  cold-install budgets are part of the public candidate contract.
- Owner and dependencies: scaffold/public package release; `G5-03`, `G6-01`.
- Required proof: malicious archive count/size/ratio fixtures, interruption
  cleanup, final package-size/cold-install thresholds, real-registry integrity,
  and supported OS/Node matrix.

## Positive Controls To Preserve

The audit also verified meaningful strengths that later fixes must not weaken:

1. release ZIP validation rejects traversal, absolute paths, symlinks, excessive
   file count, excessive individual files, and excessive extracted size
2. private release inspection tokens are signed, scoped, expiring, and compared
   safely
3. platform-side remote browser configuration already requires its client token
4. production realtime auth fails closed when its backend authority is absent
5. socket authorization binds controller identity to socket, room, and session
6. operator role is re-read from the database rather than trusted from client
   claims
7. local machine tokens use private directories/files and atomic replacement
8. first-party product telemetry minimizes identifiers, bounds requests, avoids
   raw IP/full URL/query/email/fingerprinting, and keeps approximate analytics
   separate from authoritative operations
9. staging validation already compares provider environment, service, database,
   storage, and secret identities before a golden-path run
10. npm trusted publishing, provenance, frozen dependencies, and local SHA-512
    package proofs provide a strong base for exact-artifact publication
11. generated controller URLs use cryptographic capabilities, and lifecycle/
    join paths already have several quotas and negative tests
12. the operational contract defines fail-closed, preview-bound, bounded,
    reversible, audited remediation rather than arbitrary shell automation

## Decisions And Sequencing

All seventeen findings are `accepted-existing`; no new readiness item is
required. Their implementation is already represented by `G5-02`, `G5-03`,
and the cited Gate 3, Gate 4, Gate 6, and Gate 7 dependencies.

The canonical sequence is:

1. close `AJ-SEC-001` first because origin isolation changes release serving,
   iframe policy, bridge contracts, browser moderation, configuration, and
   production topology
2. close the authority chain: `AJ-SEC-002`, `AJ-SEC-003`, and `AJ-SEC-005`
3. close remote-execution and ingress risk: `AJ-SEC-004` and `AJ-SEC-006`
4. land the Gate 3 durable resource/admission foundation, then close
   `AJ-SEC-007` and `AJ-SEC-008` without creating alternate quota or job models
5. close reporter privacy and provider/auth operations in `AJ-SEC-009` and
   `AJ-SEC-013`
6. complete provenance and privacy work in `AJ-SEC-010` through `AJ-SEC-012`
7. prove moderation/takedown and privileged audit behavior in `AJ-SEC-014`
   through `AJ-SEC-016`
8. close final scaffold/package resource budgets in `AJ-SEC-017`
9. submit one complete residual-risk packet to `G5-04`; do not ask for repeated
   informal approval during implementation

The first implementation slice after this audit should therefore establish the
dedicated untrusted-content origin contract and hostile-artifact proof. It is
the highest-impact fix and an architectural prerequisite for honest public
hosting.

## G5-01 Completion Evidence

`G5-01` is complete when this document:

1. remains linked from the canonical docs index
2. passes formatting, link, canonical, and readiness validation
3. is retained as typed readiness evidence
4. leaves `G5-02` and `G5-03` dependency-ready with no duplicate tracker

Implementation and residual-risk acceptance remain open by design. Completing
the threat model is not a claim that the threats are fixed.
