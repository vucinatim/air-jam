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
  - the generation-native successor at
    `apps/platform/src/app/releases/g/[gameId]/r/[releaseId]/generations/[generationId]/[[...assetPath]]/route.ts`
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

#### 2026-09-12 implementation evidence

The local CLI/MCP shared transport now binds reused saved tokens to their
stored platform origin before network IO. Invalid URLs fail explicitly; remote
targets require HTTPS, with HTTP limited to literal loopback development.
API paths cannot escape the selected origin, fetch rejects redirects (including
same-origin device-code replay), and device login validates the response issuer
before storing the requested platform. Deliberate explicit-token/self-hosted
targets remain supported. No new token schema, policy service, permission
prompt, or duplicate adapter-specific implementation was introduced.

The focused `packages/devtools-core/tests/platform-auth.test.ts` suite passes
28 tests on Node 24.12.0, including real HTTP 307 same/cross-origin destinations
receiving zero redirected requests, pre-IO origin mismatch rejection, unsafe
URL rejection, normalized equivalent origins, explicit alternate tokens, and
login-response issuer mismatch. Explicit test-root typechecking and scoped lint
also pass. The integrated `pnpm check:batch` passed on Node 24 after combining
the fix with the completed reliability work; the focused 28-test suite also
passed again on that tree in 3.02 seconds. These prove the destination boundary,
not a new claim about server token rotation, revocation, or all remaining
provider tooling. The single Canonicalizer session
`0b1bdde0-0b27-489f-8a96-5478c72d0b52` returned **READY**, confirming one
credential-transport owner without a new schema or adapter layer.
The change is local, not yet published or deployed; `G5-02` remains open.

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
- Canonical end state: claims bind `jti`, audience, session kind, and allowed
  origins; the server consumes each `jti` atomically once. An active
  master host can be replaced only with a server-issued reconnect/lease
  capability.
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

#### 2026-10-04 managed isolation decision

Tim accepted managed Cloudflare browser isolation instead of the independently
enforced browser-network firewall described in the original end state above.
Railway remains the trusted product/job host; untrusted capture does not run
on the private bee host. Browser private-IP/DNS-rebinding containment is not
independently established or claimed. Generation-scoped credentials, public-only
DNS-pinned privileged fetching, capture limits and owned session cleanup remain
required. The [current capture plan](../../plans/release-browser-worker-containment-plan.md)
governs this replacement; the original self-hosted design is historical.
Integration, narrow machine credentials and reviewed hosted/production proof
remain open, so this decision alone does not close the finding.

#### 2026-09-12 worker containment work in progress

The [historical bounded containment plan](../../archive/2026-10-04-self-hosted-release-browser-containment-plan.md)
keeps the existing worker/provider, job admission, and moderation ownership.
Read-only provider state confirms the current deployed worker has a configured
token of at least 32 characters, but still runs its original root/sandbox-off
image. Dropped-privilege user/network namespace probes and a sandbox-requested
UID 65534 Chromium `145.0.7632.6` blank-page launch pass. Headless shell does not
provide `chrome://sandbox`; this is feasibility evidence, not final image or
network-isolation attestation. Probe browser resources were closed.

Local source now requires worker credentials and sandbox-on configuration,
rejects root execution, removes worker/provider secrets from browser child env,
and configures the Docker image's non-root user. Ten focused env/auth tests,
worker typechecking and scoped lint pass. No Docker-image or deployment success
is claimed for the changed source.

Inspection v2 binds the exact game/release/generation; 16 focused token tests
pass. Capture removes context-wide headers and fetches private assets with
automatic redirects disabled. The credential stays out of browser request
headers. Eight routing units and one actual Chromium fixture pass: private host
and chunk load, while same-origin outside-path and cross-origin redirect targets
and external asset requests receive no inspection token. The two owned fixture
servers are loopback; the test explicitly grants local-network access only for
those fixtures. This is credential-confinement proof, **not SSRF containment**.

Capture now uses the declared viewport instead of unbounded document height,
blocks service workers/downloads and popups, and requires authenticated remote
execution. The local unisolated launch fallback is removed from configuration,
capture and staging verification. Capture/config tests (35) and staging tests
(14) pass, including bounded capture/cleanup, viewport and PNG output limits.

The shared address classifier's 40 tests and 15 worker proxy tests pass. Local
worker source now owns one browser/proxy per connection, a hard lifetime,
HTTP/WS/CONNECT public-only pinned egress, transfer/admission bounds and a
browser-backed health probe. A further UID 65534 provider probe opened a blank
Chromium page inside user/network/PID namespaces after capability dropping.
This is feasibility, not validation of the new launcher or proxy integration.
Six worker-entry/lifecycle and three CLI tests also pass. They caught and fixed
a half-open client disconnect that could otherwise retain its browser until the
deadline. Chromium is mocked in entry tests; the real sockets and owned proxy/
directory cleanup are exercised without claiming actual process isolation.

The subsequent 19-test proxy run includes real TLS identity/SNI and invalid-
certificate rejection, real Chromium HTTPS/WSS messaging, and confirmation that
Playwright's Node-side private fetching shares the proxy and cannot reach an
owned loopback listener. Only the browser fixture pins its test certificate;
production trust is unchanged. This strengthens protocol/driver evidence, not
the still-missing exact-image namespace proof.
Capture also now rejects failed/missing HTTP host responses before creating any
screenshot artifact, rather than letting an error page masquerade as a loaded
game. The 13 capture-service tests include error-page cleanup/storage regressions.

**Finding remains open:** the exact Docker image build hit Docker storage
exhaustion before runtime proof. No unrelated Docker resources or database volumes
were removed. The [historical plan checkpoint](../../archive/2026-10-04-self-hosted-release-browser-containment-plan.md#implementation-and-proof-checkpoint--2026-09-12)
records the pending scoped cleanup decision, provider mount-policy limitation,
and remaining exact-image/private-asset/TLS/WS/direct-network/cancellation proof.
Final integrated batch, canonicality review and reviewed delivery have not run.

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
- Canonical end state (reconciled 2026-09-12 with the no-new-player-prompts
  product contract): room codes are party invitations, not private-room
  authentication. Participants keep ordinary inputs, player actions, sounds,
  and cooperative system controls. They cannot impersonate the host or resume
  another player's slot using public IDs. Actual owned host actions use the
  [private runtime-owner path](../../contracts/agent-session-contract.md#player-participation-and-host-ownership);
  controller resume uses a server-issued private token. The earlier proposal
  to add approval to manual joining is superseded, not implemented.
- Owner and dependencies: SDK and realtime controller authorization; `G5-02`.
- Required proof: negative tests for every privileged event without the proper
  capability, plus brute-force/rate, expiry, rotation, reconnect, manual-entry,
  and host-revocation tests.

#### 2026-09-12 implementation evidence

The controller host-impersonation event, schema, and payload type are removed.
Networked player actions always receive server-derived controller identity.
Owned-host IPC instead invokes the existing local store dispatcher through the
separate browser-realm control contract. Missing ownership is explicit in
session discovery/results; no delegation grants or new service were added.

Resume now requires the existing slot's private server-issued token (or its
already bound socket for an idempotent join). Public controller/device IDs,
including those copied from presence, are insufficient. The admission await
rechecks current slot identity/lease/owner to prevent concurrent overwrites.
Removal invalidates the old slot; a later fresh join receives a new token and
does not restore previous authority. The private ACK is retained in SDK memory
and structured local storage, not forwarded through public welcome messages.
Legacy ID-only bindings are discarded. Denied browser storage uses existing
in-memory behavior; reload without durable storage necessarily joins fresh.
The same exercise fixed the existing settings-storage getter throwing during
controller rendering, through its existing persistence owner.

Focused evidence includes 38 SDK local-control/store tests, 39 controller/
settings SDK tests, 33 server routing/lifecycle/admission tests, and 23 devtools
IPC/frame/observation tests plus 31 broader devtools tests. Overlapping suites
are not summed as unique coverage. Explicit affected source/test TypeScript
and scoped lint pass. Tests retain ordinary cooperative controls, deny forged
host identity and public-ID resume, cover stale admission races and expiry,
and verify exact realm targeting, listener/replication parity, stale binding
cleanup, private-token omission, and ambiguous acknowledgement semantics.

Real Node 24 source proof used the normal `pnpm run dev -- --game=pong` stack
with its loopback database, then the canonical devtools controller/semantic
action APIs. Owned standalone room `DN7N` and embedded Arcade room `X7W2` both
joined a team, added a bot, and started a match through player actions. Their
host `scorePoint` calls returned accepted acknowledgements and replicated
team1 scores from 0 to 1. The standalone store used `default`, revisions 3→4;
the embedded store used `aj.embedded.game:2:local-reference-pong`, revisions
3→8. Live bot play also changed the embedded opponent score; this is not an
isolated physics assertion. Both owned sessions closed successfully, and the
unified error-level stream was empty. These prove the source-level owned-host
transport, not a new full external-agent release rehearsal or deployed proof.

The integrated batch passed generated-source checks, workspace typechecking,
lint, and canonical guards before reaching tests. The combined server run
exposed a 100 ms test-fixture resume-window race; authority tests now preserve
their intended live slot rather than racing expiry. A separate log test now
awaits the existing flush operation instead of sleeping 25 ms. The SDK export
test was updated to assert the new public control leaf rather than its former
absence. No production timeout was widened or negative assertion weakened.
Validation resumed at the affected test stages: the full server suite passes
203 tests (41 opt-in database cases skipped); platform passes 487 tests (82
opt-in database cases skipped). SDK passes its 281 unchanged/passing cases and
the corrected export contract plus runtime-control rerun passes all eight
cases. This is a completed batch with targeted fallout rechecks, not a claim
that the initial uninterrupted command exited successfully. Earlier focused
devtools and real-browser evidence above remain applicable. The single
Canonicalizer session `77b8f1f0-3f01-4788-8e45-6512fc314b52` returned **READY**:
the impersonation path is deleted, host control reuses the existing dispatcher,
and resume authority has one owner. Its optional micro-consolidations do not
block this batch; a generic IPC abstraction was deliberately not added for
only two operations with different error contracts.
`G5-02` remains open for other launch-critical findings and reviewed delivery.

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

- Integrated local report regression (2026-09-12): all 54 tests across the
  application service, machine projections, router/HTTP boundary, report form,
  operator input, intake input, and rendered release panels passed together
  (2.76 seconds). The instant gate passed in 912 ms. This proves the combined
  local report slice, not worker-image containment or production readiness.
  No report deletion interval is ratified in the current roadmap. The proposed
  maintainer decision is deletion of reports, optional contact, and decision
  history 90 days after review/dismissal, with open reports retained and
  reopening cancelling eligibility. This is a proposal only: no retention
  implementation, public promise, or production deletion is authorized by it.
- The subsequent repository batch passed generated sources, workspace types,
  lint, canonical guards, repo contracts and the early package suites, then
  failed in ordinary realtime-server tests (44 failures). Reproduction traced
  this to the repo CLI loading the developer's `DATABASE_URL`: temporary test
  servers joined the same database authority and correctly drained siblings
  under the single-server model. A second full reproduction failed 47 tests;
  an isolated case passed. This is a test-isolation defect, not evidence to
  weaken production admission. It also disturbed the local dev runtime; the
  canonical reset and `pnpm run dev -- --game=pong` restored it. `/ready`
  returned accepting-new-work with no error, and the in-app Arcade connected
  room `5ZBY`, rendered Pong and had no captured console errors. The owned
  verification tab was closed. The remaining SDK and platform stages passed
  separately (282 SDK; 538 platform, 115 opt-in cases skipped). The failed
  initial batch is not counted as an uninterrupted pass.
- The test-isolation repair passed the entire server suite with an unusable
  inherited database URL and a forbidden dev-log destination: 205 tests passed,
  41 explicit PostgreSQL cases skipped (11.79 seconds). Vitest setup now removes
  inherited database/log destinations before importing runtime consumers and
  disables default dev collectors. Logging tests explicitly own their existing
  temporary collectors; `AIR_JAM_TEST_DATABASE_URL` remains opt-in and untouched.
  Production admission, joining, and runtime policy did not change. Explicit
  test-root types and scoped lint passed. A final two-test rerun (409 ms)
  corrected the regression test itself so importing its helper cannot supply
  a missing setup hook and mask the bug. This completes the batch's remaining
  test stages with focused fallout rechecks; exact worker-image proof and the
  single final Canonicalizer review are still pending.
- Local migration-stack inspection (2026-09-12; read-only): launch HEAD
  `1373e48c` contains `0040_operational_evidence_reference_indexes` (introduced
  by `65e56ac6`), whereas the host-authority PR branch at `22643106` contains
  `0040_host_grant_consumption`. Both descend from `0039`; the launch branch's
  current `0041`/`0042` snapshots omit the host-grant table. The initial
  source-only check did not establish applied database history; its provisional
  numbering was superseded by the inspection below. Migration references in
  the report evidence describe this branch before cumulative reconciliation.
- Follow-up migration-history inspection (2026-09-12; no database mutation):
  production and the current launch-experience local database are at `0039`,
  with no unknown migrations. The preserved repo-default `airjam` database
  contains the original host `0040` hash
  `f8b2cd744cfaa64055fa79dc0ba7972757466b7a47729f798a12715e85bec7e7`.
  Host review had removed a cross-clock chronology constraint by editing that
  migration. On the host branch, restore the applied SQL and snapshot exactly
  and append `0041_host_grant_clock_authority` to remove the constraint. The
  corrected source now classifies the preserved database as `behind` with only
  `0041` pending, not drifted. The database itself remains unchanged.
  The integration order is host `0040`, its forward correction `0041`, evidence
  indexes `0042`, report decisions `0043`, and submission keys `0044`. Regenerate
  cumulative snapshots and predecessor IDs, journal timestamps newer than host
  `0041` (`1789246514169`), and schema-head metadata together. Preserve both
  branches' protocol removals and host/controller resume authority, plus the
  launch branch's server-test database/log isolation. No branch was merged.
  This audit also corrected two unqualified constraint-verification directives
  in the never-applied report decision migration; its schema and report behavior
  did not change. Final-state removal verification and migration upgrade proof
  live with the host correction, not a second migration registry.
- Local intake update (2026-09-12; unmerged, not deployed): anonymous reporting
  now enters one shared application service, targeting the exact displayed
  release. A private UUID submission key is separate from the creator-visible
  report ID; receipts contain only `{submissionId, received: true}`. Identical
  private-key retries are atomic, preserve their receipt after quarantine or
  review, and consume no additional storage. Different keys remain independent
  even when their content matches. Cross-person content coalescing was rejected
  during implementation because it can reveal whether someone else submitted
  a guessed email/body. The earlier ID/status receipt below is superseded.
  Migration `0042_release_report_submission_keys` adds the private key and its
  unique index without adding an identity-tracking system.
- Shared intake budgets are 120 new rows/UTC minute and 1,000/UTC day, enforced
  under a PostgreSQL transaction lock. A fixed-key 240 requests/minute process
  brake bounds ordinary ingress work without relying on spoofable client IPs
  or allocating per-client state. `reports policy` and `reports status --json`
  expose the policy and shared usage without report contents. Busy responses
  carry HTTP 429, retry metadata, and a Retry-After header; the form keeps its
  draft and private key, prevents double-submit, and distinguishes bad input,
  unavailable releases, conflicts, and transient failures using safe text.
  These are persistence/ingress bounds, not a DDoS-prevention claim. The full
  report retention lifecycle and reviewed production rollout remain open.
- Final intake proof: 18 real PostgreSQL, eight router/privacy/HTTP, and seven
  input tests passed together (33 tests, 2.79 seconds). Concurrent retries and
  budget races, UTC resets, unavailable target rejection, public-ID/private-key
  separation, independent identical reports, and privacy-preserving receipts
  are exercised. A real metadata-only `reports status --json` call passed.
  The fresh fully migrated database was dropped successfully. Five React draft/
  recovery tests and 11 CLI/migration contract tests passed; scoped lint and
  explicit test-root types are clean. Scoped changed gate: 8.75 seconds cold,
  4.07 seconds warm. An earlier discarded-contract run exposed a raw SQL Date
  encoding defect, fixed by using the column-aware comparison; an impossible
  live/failed-generation fixture was replaced with proof of the existing
  database constraint. Neither earlier run is counted as closure evidence.
- Local operator-path update (2026-09-12; unmerged, not deployed):
  `platform operations reports list|inspect|decide` now provides a bounded
  metadata inbox, explicit private inspection with paged history, and
  revision-checked decisions. `open`, `reviewed`, and `dismissed` remain the
  existing vocabulary; decisions can be corrected or reopened. A transaction
  writes the report state and private decision receipt together; exact command
  replay cannot duplicate a decision or undo a later one. This uses the existing
  repo operator database authority; actor is an audit identity, not a public
  authorization claim. There is no automatic quarantine or catalog mutation.
  Migration `0041_release_report_decisions` adds only the report revision and
  its decision history, with explicit online/verification metadata. History
  cascades with report deletion; no new global logging or moderation framework
  was introduced. See the
  [platform architecture](../../architecture/platform-control-plane-architecture.md#release)
  for CLI usage and the privacy/effect boundary.
- Operator-path proof: 15 input-boundary tests and 14 real PostgreSQL tests
  passed in 1.53 seconds against a fresh, fully migrated loopback database.
  They cover preview/no-write, atomic rollback, concurrent same-key replay,
  conflicting decisions, changed-key payload rejection, reopening, unaffected
  game/release state, private inspection, and bounded report/history pages.
  Eight real repo CLI invocations against a second fresh fixture proved
  list → inspect → preview → apply → replay → conflict → reopen → history page
  (1.1–1.8 seconds each). Private output remained captured; only sanitized
  assertions were retained. Both generated databases were dropped successfully;
  no existing database was migrated or edited. Four CLI discovery/parser/error
  tests and six migration-policy tests pass. The preceding 24 privacy tests
  still pass. Platform types, scoped lint, explicit test-root/CLI types, and
  formatting pass; scoped changed gate was 11.19 seconds cold, 3.65 seconds
  warm. Batch/Canonicalizer/PR review and production migration are still pending.
- Local privacy boundary update (2026-09-12; unmerged, not deployed): the
  shared creator application service now returns only report identity, status,
  source, and timestamps. Raw reason/details are ops-confidential alongside
  email: hiding the dedicated contact field alone would still expose personal
  information written into the report. Creator list/get and mutation read-backs
  share the same allowlist; machine types and serialization no longer contain
  those private fields. The existing ops authority retains the full report.
  Public submission returns only an ID/status receipt, and form/dashboard copy
  describes the boundary. This supersedes the projection leak described in the
  original evidence below, not the remaining intake/lifecycle finding.
- Local proof: 24 focused tests passed across `release-application-service`,
  `machine-release`, `release-privacy` router, and `release-detail-panels` suites
  (1.28 seconds combined). The router tests use real middleware/application
  services with database IO mocked: unauthenticated reads and creator ops
  access fail; authorized ops retains private evidence; creator get/list and
  public receipts do not expose it. Service tests cover mutation read-backs and
  future-field exclusion; machine serialization/schema and rendered states are
  covered separately. Platform typecheck/scoped lint and explicit test-root
  TypeScript passed. This is not a live database/browser or deployment proof.
  The fast changed gate correctly requests the pre-push batch for the public
  SDK schema change; that batch/review remains pending with worker integration.
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
  - the original publish workflow mixed dependency installation, rebuilding,
    npm OIDC, mutable action/tool references, and publication
  - the original isolated-registry proof repacked per cell and therefore did
    not prove one byte identity from build through publication
- Closure evidence (2026-09-04):
  - `scripts/repo/lib/public-release-candidate.mjs` creates and strictly
    validates one clean-commit candidate containing exact package, dependency,
    license, audit, lockfile, manifest, and toolchain identity
  - `.github/workflows/publish-packages.yml` separates candidate, six-cell
    verification, aggregate, OIDC publish, and source-finalization authority;
    the publish job installs no repository dependencies and cannot rebuild
  - every workflow action is pinned to a full commit SHA; the npm version is
    exact; package integrity and provenance are verified after publication
  - [Supply-Chain, Telemetry Privacy, And Emergency Release Proof](./supply-chain-release-trust-proof.md)
- Current controls: build-once exact candidate, complete public graph,
  dependency/license/audit evidence, frozen lockfile, SHA-pinned workflows,
  job-level least privilege, trusted publishing, provenance, safe retry
  reconciliation, and SHA-512 registry verification.
- Threat and harm: a compromised install dependency/action or mutable tool can
  run in a credentialed job; the bytes tested are not necessarily the bytes
  rebuilt and published.
- Canonical end state: implemented. A protected GitHub environment remains an
  optional later policy layer because enabling it before npm's trusted-
  publisher records match would break the token-free publisher.
- Owner and dependencies: release engineering; `G5-03`, `G6-01`, Gate 7.
- Remaining proof: configure all five npm trusted-publisher records and retain
  the first real-registry prerelease evidence in Gate 7. The implementation
  remains blocks-1.0 until that external rehearsal succeeds.

### AJ-SEC-011 — Mutable unsigned AI-pack origin can rewrite agent-facing project guidance

- Category: supply-chain
- Priority: P1
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence:
  - the original platform-generated manifest and content hashes came from one
    mutable hosted authority
  - the original CLI accepted remote and local override authorities before
    updating agent-facing project instructions
- Closure evidence (2026-09-04):
  - the updater's sole authority is now the schema-2 guidance snapshot packaged
    inside the installed `@air-jam/cli` artifact
  - hosted manifest URLs, override files, fetches, and fallback behavior were
    removed rather than retained as compatibility paths
  - strict pre-write size/hash/content validation, version rollback refusal,
    same-version repair, symlink refusal, staged commit, rollback, and obsolete-
    managed-file removal are executable and tested
  - [Supply-Chain, Telemetry Privacy, And Emergency Release Proof](./supply-chain-release-trust-proof.md)
- Current controls: provenance-bound packaged snapshot, strict schema and exact
  file identity, rollback protection, managed-file-only transactional update,
  and explicit repair.
- Threat and harm: compromise of the platform/CDN or a local manifest override
  can distribute internally consistent malicious instructions to privileged
  creator agents. Hashes from the compromised origin do not establish trust.
- Canonical end state: implemented through the smaller provenance-bound package
  authority. There is no network update path requiring a parallel signature,
  expiry, redirect, or host-allowlist system.
- Owner and dependencies: CLI, public docs/AI-pack release; `G5-02`, `G5-03`.
- Remaining proof: the final `@air-jam/cli` tarball must pass the coordinated
  npm provenance rehearsal in Gate 7. Network-origin attack cases are removed
  from the reachable update model rather than accepted and filtered.

### AJ-SEC-012 — Telemetry, session, OAuth, and account retention/privacy are not fully enforced

- Category: privacy
- Priority: P1
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence:
  - product telemetry originally had strong request minimization and a
    documented 90-day raw retention policy, but retention was only callable
  - runtime analytics retain room/app/origin identity and arbitrary payloads in
    `packages/database-contract/src/index.ts:35-208` and
    `packages/server/src/analytics/runtime-usage.ts:8-31`
  - platform sessions store IP and full user agent, while account rows may
    retain OAuth access/refresh/ID tokens in
    `apps/platform/src/db/schema.ts:47-87`
  - no complete account export/delete, token minimization/encryption, runtime
    retention, or restore-boundary deletion proof was found
- Closure evidence for the product-telemetry slice (2026-09-04):
  - the operational worker now implements the canonical retention service on
    startup and on a bounded schedule, reports it as an independent readiness
    authority, and drains an in-flight run during shutdown; `G3-08` still owns
    production activation and observation
  - `/privacy` publicly discloses the executable telemetry schema,
    minimization, ephemeral identity, retention, and aggregate reporting while
    explicitly excluding unresolved data planes
  - [Supply-Chain, Telemetry Privacy, And Emergency Release Proof](./supply-chain-release-trust-proof.md)
- Current controls: minimized first-party product telemetry, bounded same-origin
  ingestion, no raw product-telemetry IP/full URL/query/email/fingerprinting,
  deterministic projections, readiness-owned scheduled retention capability,
  CLI retention preview/apply, honest activation-aware public disclosure, and
  ordinary session expiry fields.
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
- Remaining proof: `G3-08` owns production activation and observation of
  recurring telemetry retention. `G5-02` and Gate 3 still own runtime
  payload/retention, account and OAuth minimization, export/deletion,
  report/media lifecycles, and their production expiry and restore-boundary
  drills. This finding remains blocks-1.0; only the product-telemetry behavior
  and disclosure are implemented here.

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

### AJ-SEC-017 — Scaffold resource controls require final matrix and registry proof

- Category: supply-chain
- Priority: P2
- Severity: medium
- Release classification: before-scale
- Confidence: high
- Evidence:
  - `packages/create-airjam/scaffold-resource-budgets.json` now owns compressed,
    entry-count, total extracted-byte, single-file, and compression-ratio
    ceilings
  - `packages/create-airjam/src/scaffold-archive.ts` preflights those limits,
    rejects non-regular and portable-path-conflicting entries, extracts into a
    sibling staging directory, and publishes the target only after complete
    extraction
  - `packages/create-airjam/runtime/scaffold-resource-budgets.test.ts` covers
    every packaged archive plus malicious count, size, ratio, corrupt-stream,
    cleanup, and successful atomic-publication cases
  - `packages/create-airjam/src/scaffold-command.ts:267-304` performs an ordinary
    package-manager install
  - the current candidate `create-airjam` tarball is approximately 87 MB because
    it embeds six scaffold archives
- Current controls: archives are bundled in the trusted package; entry type,
  path, collision, size, count, and compression limits fail closed; partial
  extraction is never exposed as the requested target; the exact local package
  graph has SHA-512 clean-room proof; and generated projects pass quality gates.
- Closure evidence (2026-09-04): the immutable candidate now carries these
  exact tarballs into every support-matrix cell; aggregate evidence binds each
  package SHA-256 and integrity value to one candidate digest. See the
  [supply-chain release trust proof](./supply-chain-release-trust-proof.md).
- Threat and harm: after a supply-chain compromise or future scaffold growth,
  extraction/install can consume surprising disk, time, or dependency surface.
- Canonical end state: generic extraction budgets and deterministic package/
  cold-install budgets are part of the public candidate contract.
- Owner and dependencies: scaffold/public package release; `G5-03`, `G6-01`.
- Remaining proof: all six supported OS/Node cells must attest the shipped
  extraction contract and final package-size/cold-install thresholds; the final
  approved npm prerelease rehearsal must bind the same tested tarballs to
  real-registry integrity and provenance.

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
