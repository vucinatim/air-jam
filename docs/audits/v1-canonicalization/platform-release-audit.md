# Platform and Release Canonicalization Audit

Last updated: 2026-08-28
Status: complete; cross-reviewed
Finding range: `CAN-100` through `CAN-199`

This report follows [audit-contract.md](./audit-contract.md). It is a read-only
architecture audit. It does not assign execution status; the decision register
and readiness manifest own decisions and accepted work.

## Lane Map

### Production composition roots

| Boundary                     | Composition root                                                                                                                | Current authority                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform web and API process | `apps/platform/next.config.ts`, `apps/platform/src/app/`, `apps/platform/src/server/api/root.ts`                                | One Railway-hosted Next.js process owns public pages, Arcade, auth, dashboard, tRPC, machine HTTP routes, release orchestration, media delivery, and product telemetry.     |
| Platform database            | `apps/platform/src/db/index.ts`, `apps/platform/src/db/schema.ts`, `apps/platform/drizzle/`                                     | PostgreSQL owns identity, games, releases, media metadata, runtime analytics projections, and product telemetry. Drizzle migrations are authored from the platform package. |
| Realtime analytics writer    | `packages/server/src/db.ts`, `packages/server/src/analytics/`                                                                   | The realtime server writes platform-owned `runtime_usage_*` tables through a separately declared Drizzle schema.                                                            |
| Browser worker               | `packages/release-browser-worker/src/main.ts`, `packages/release-browser-worker/src/index.ts`                                   | A Railway service owns a long-lived Chromium browser server and Playwright WebSocket proxy.                                                                                 |
| Deployment runtime           | `apps/platform/Dockerfile`, `apps/platform/scripts/run-platform.mjs`, `apps/platform/railway.json`, worker Docker/Railway files | Railway starts platform and worker. Preview boot applies migrations; production migration is a separate manual procedure.                                                   |

### Product and release paths

| Capability                   | Human surface                        | Machine surface                                                      | Domain/data path                                                                       |
| ---------------------------- | ------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Game catalog and ownership   | tRPC `gameRouter`, dashboard, Arcade | `/api/cli/games/**`, public CLI/MCP                                  | `server/games/`, `games`, `app_ids`, public release lookup                             |
| Hosted release submission    | creator releases dashboard           | `/api/cli/releases/**`, `airjam release`, Air Jam MCP                | `machine-release.ts`, artifact service, R2, release tables                             |
| Release checks and promotion | creator and ops release UIs          | creator inspect/finalize/publish; no ops lifecycle machine API       | validation, screenshot, moderation, status services                                    |
| Public release serving       | Arcade and `/play/[slugOrId]`        | stable URLs returned by machine API                                  | dynamic `/releases/g/**` reads DB/R2 and rewrites text assets                          |
| Managed catalog media        | media dashboard and catalog          | `/api/cli/games/**/media/**`                                         | media service, metadata, shared R2, dynamic `/media/g/**`                              |
| Abuse reports                | public form and ops/creator panels   | reports included in creator summaries; no ops action API             | `game_release_reports`, `releaseRouter.reportPublic`                                   |
| Product telemetry            | collector and ops dashboard          | repo CLI telemetry overview, health, rebuild, and retain             | strict contract, ingestion, raw ledger, daily projection, retention                    |
| Runtime creator analytics    | creator UI and ops overview          | no creator CLI in this lane                                          | platform reads `runtime_usage_*` written by realtime server                            |
| Platform recovery            | none                                 | `repo platform database backup`; migration inspect/plan/apply/verify | fingerprinted backup and guarded migration lifecycle; isolated restore remains `G3-03` |

### Provider and expensive-work boundaries

1. PostgreSQL is the metadata and analytics authority.
2. R2 stores ZIPs, expanded release sites, moderation screenshots, and catalog
   media through one provider-neutral storage interface.
3. The browser worker supplies remote browser execution; the platform performs
   navigation, screenshot persistence, and moderation.
4. OpenAI image moderation is optional provider IO owned by the platform.
5. Extraction, thousands of R2 writes, browser capture, screenshot
   round-tripping, and moderation run inside one finalize HTTP request.

## What Is Already Canonical

1. **The product nouns are strong.** `Game`, `Release`, `Artifact`, `Check`,
   `Report`, managed `MediaAsset`, and `ArcadeVisibility` are distinct. Release
   statuses and artifact contracts are exported from `packages/sdk/src/release.ts`.
2. **Public Arcade resolves immutable uploaded releases** rather than trusting a
   mutable public URL. Preview URLs remain a separate creator-only lane.
3. **Archive validation protects real invariants.** It rejects traversal,
   symlinks, invalid roots, excessive files, oversized entries, and excessive
   extracted size, with focused tests.
4. **Storage has a useful provider boundary.** `ReleaseStorage` is small and
   explicit; release and media services share R2 while keeping separate keys.
5. **Private inspection is capability-scoped.** Moderation receives a
   short-lived HMAC token bound to one game/release, with scope and expiry tests.
6. **Creator machine routes are thin and schema-checked.** They authenticate,
   invoke server functions, and validate JSON with `@air-jam/sdk/platform-machine`.
7. **Product telemetry is deliberately bounded.** It has a closed union,
   request guards, idempotency, privacy normalization, transactional evidence
   and projections, deterministic rebuild, retention, and shared CLI services.
8. **Major workloads have understandable top-level separation:** platform,
   realtime server, browser worker, PostgreSQL, and object storage.

## Findings

### CAN-100 — Untrusted hosted games can execute on the authenticated platform origin

- Category: boundary
- Complexity: unclear-ownership
- Severity: critical
- Release classification: blocks-1.0
- Confidence: high
- Evidence at audit time: `apps/platform/src/server/releases/release-public-url.ts#getHostedReleasesBaseUrl` fell back to `getSiteUrl()`; `apps/platform/src/app/releases/g/[gameId]/r/[releaseId]/generations/[generationId]/[[...assetPath]]/route.ts#GET` served creator HTML/JS; `apps/platform/src/components/arcade/game-player.tsx#GamePlayer` rendered the host iframe without `sandbox`; `controller-game-frame.tsx` combined `allow-scripts` and `allow-same-origin`; the former release-origin configuration was optional.
- Current implementation status (2026-08-30): the stacked Gate 5 origin-boundary change removes the platform fallback, requires a separate cookie site, rejects creator bytes on the platform origin, and applies explicit host/controller frame policy. Production provisioning and deployed hostile proof remain open, so the finding is not yet accepted as closed.
- Architectural harm: Creator code shares origin powers with auth, dashboard, machine APIs, telemetry, and platform storage. A malicious game can attempt authenticated same-origin requests or read origin-scoped data.
- Canonical end state: Hosted artifacts are served only from a mandatory untrusted-content origin with no platform auth cookies or product APIs. Frames use an explicit sandbox/permission policy as defense in depth.
- Change: Remove the same-origin production fallback; require and validate release-origin identity; route content through an isolated serving plane; add compatible iframe sandbox and response security contracts.
- Dependencies and blast radius: Release URLs, Railway domains, auth cookies, runtime topology, bridges, CSP, moderation inspection, catalog URLs, local dev, and browser tests.
- Validation: Production-topology tests prove origins differ; a malicious fixture cannot access authenticated platform state/API; bridge smokes pass under sandbox; deploy checks fail closed without isolation.

### CAN-101 — The platform request path is the release and media CDN

- Category: composition
- Complexity: accidental-complexity
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: release `GET` is `force-dynamic` and performs release/game/artifact DB reads, R2 head/read, full buffering, and per-request HTML/JS/CSS rewriting; media `GET` similarly performs DB lookup, R2 head/read, and buffering; `release-storage-r2.ts#readObject` buffers every body; the roadmap targets `500` sustained / `1,500` burst cached requests per second.
- Current behavior: Every cold static asset traverses Next.js and DB/object-storage adapters. Immutable assets are dynamically authorized and rewritten on each request; catalog media is also proxied.
- Architectural harm: Static traffic competes with auth, orchestration, telemetry, and Arcade for CPU, memory, DB connections, and network. One game page amplifies into many dynamic application requests.
- Canonical end state: Finalization produces immutable ready-to-serve artifacts once. A dedicated untrusted CDN/static origin serves object storage directly; the control plane owns promotion/revocation without serving bytes.
- Change: Move transformation to artifact preparation where possible; add a serving/edge adapter; keep a narrow private inspection path; make cache, purge, and revocation explicit.
- Dependencies and blast radius: CAN-100, artifact layout, SPA fallback, topology injection, R2, catalog/media URLs, moderation, provider config, and load tests.
- Validation: Production-like load meets target without proportional platform/DB origin traffic; quarantine revokes within a bound; maximum-size files do not consume platform memory.

### CAN-102 — Browser-worker access and health fail open

- Category: boundary
- Complexity: contract-drift
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `packages/release-browser-worker/src/env.ts` makes `AIRJAM_BROWSER_WORKER_ACCESS_TOKEN` optional; `access-control.ts#isAuthorized` returns true when absent; its test locks in "allows all requests when access token is unset"; the public listener proxies Playwright WebSockets; `/health` never checks Chromium; deployment docs call access an explicit auth boundary.
- Current behavior: A missing variable turns the public worker into an unauthenticated browser endpoint. Health may stay green after Chromium or the internal target dies.
- Architectural harm: Remote browser control is a privileged code/network surface. Fail-open config exposes it, while shallow health prevents reliable automated recovery.
- Canonical end state: Hosted startup fails without strong identity (or equivalent private network identity). Readiness verifies authentication and live browser connectivity; browser loss makes the process unhealthy or exits it.
- Change: Fail closed in hosted deployments, compare secrets safely, separate liveness/readiness, observe browser closure, and align README/provider wording.
- Dependencies and blast radius: Worker/platform env, Railway networking, healthchecks, rotation, deployment doctoring, and tests.
- Validation: Hosted config rejects no token; unauthorized upgrades fail; authorized Playwright works; simulated browser death fails readiness and triggers bounded restart.

### CAN-103 — Public status mutations bypass trusted release and media lifecycles

- Category: ownership
- Complexity: duplicated-capability
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `releaseRouter.updateStatus` lets an owner perform transitions including `checking -> ready` without checks; `gameMediaRouter.updateStatus` accepts any media status; repository-wide searches find no consumers; trusted transitions otherwise live in release artifact/moderation/status and media services.
- Current behavior: Unused authenticated endpoints expose a second state-machine authority and can declare unchecked releases or unfinalized media ready.
- Architectural harm: Trusted check results are not authoritative if a creator transport can write their outcome. Duplicate timestamp and active-slot cleanup already drift.
- Canonical end state: Only semantic operations change state: upload, finalize, trusted outcome, publish, quarantine, archive, assign, and explicit ops repair.
- Change: Delete both generic procedures with zero compatibility support; centralize remaining transitions behind release/media lifecycle services.
- Dependencies and blast radius: tRPC types, dashboard client, services, tests, contract inventory, and any caller rechecked before deletion.
- Validation: No arbitrary status mutation remains; creators cannot forge trusted states; transition tests cover every semantic edge; canonical guards reject reintroduction.

### CAN-104 — PostgreSQL cannot enforce one live release per game

- Category: canonicality
- Complexity: necessary-complexity
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `db/schema.ts#gameReleases` and all migrations lack a partial unique live-release index; `release-status-service.ts#publishRelease` reads old live rows then archives/promotes without locking/serialization; `public-release-record.ts#getLiveReleaseForGame` uses unordered `.limit(1)`.
- Current behavior: Concurrent publishes can both observe no live release and commit as live; public lookup then chooses an arbitrary row.
- Architectural harm: The immutable live-release promise becomes nondeterministic under retry/concurrency, and application checks cannot protect a shared database invariant.
- Canonical end state: PostgreSQL enforces at most one live release per game; publish serializes and atomically replaces the old live release.
- Change: Add a partial unique index or explicit live-release relation, migrate inconsistent data, and return structured conflict/retry semantics.
- Dependencies and blast radius: Drizzle schema/migrations, publish, public queries, machine errors, seed preview, and production migrations.
- Validation: Real-Postgres concurrent publish proves one deterministic winner; DB rejects a second live row; public lookup is deterministic.

### CAN-105 — Reporter contact data is exposed to the reported creator

- Category: public-contract
- Complexity: contract-drift
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `releaseRouter.reportPublic` stores `reporterEmail`; `releaseRouter.listByGame` returns full report rows to the owner; `components/releases/release-detail-panels.tsx` renders the email in both creator and ops pages; `machine-release.ts#serializeReleaseForMachine` and `packages/sdk/src/platform-machine.ts#platformMachineReleaseReportSchema` return it to creator machine sessions; no live privacy contract describes this disclosure.
- Current behavior: Someone reporting abusive, sexual, hateful, misleading, or phishing content may give Air Jam an email for follow-up; Air Jam shows and exports it to the creator being reported.
- Architectural harm: This is an unsafe privacy boundary that can expose reporters to retaliation. It also pollutes creator machine contracts with ops-only personal data.
- Canonical end state: Reporter contact is ops-confidential. Creators receive only a redacted remediation projection; ops receives the full report under explicit authorization and retention.
- Change: Add separate creator/ops projections; remove email from creator tRPC and machine schemas; define retention/privacy copy; decide whether pre-review report detail belongs in creator views at all.
- Dependencies and blast radius: Database retention, report form, tRPC inference, machine schemas, CLI/MCP, UIs, privacy docs, and public API cut.
- Validation: Creator UI/API/CLI cannot observe contact; ops can; privacy docs match storage; regression tests cover both projections.

### CAN-106 — Abuse reports have intake but no complete triage lifecycle

- Category: agent-operability
- Complexity: poor-ergonomics
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `packages/sdk/src/release.ts#releaseReportStatusValues` defines `open`, `reviewed`, and `dismissed`; searches find only insertion as open, never a status or `reviewedAt` update; ops UI can quarantine/rerun moderation but not review/dismiss; no ops report/release repo CLI or machine API exists; `reportPublic` has no dedicated rate limit.
- Current behavior: Reports remain permanently open. The UI calls itself a triage queue but cannot resolve it, and agents cannot inspect or operate it through a stable machine surface.
- Architectural harm: An unclosable, unbounded safety queue becomes noise rather than an operational control and cannot support alert/issue automation.
- Canonical end state: One report service owns bounded intake, dedupe/rate policy, ops-only inspection, reviewed/dismissed audit state, and semantic quarantine escalation. UI and repo CLI/MCP are thin adapters.
- Change: Implement the lifecycle and CAN-105 redaction; add structured ops reads/actions with explicit apply/authorization; emit events rather than inserting directly in the router.
- Dependencies and blast radius: CAN-105, ops identity, reporting UX, abuse policy, Gate 4 events/alerts, schemas, and tests.
- Validation: End-to-end tests cover intake, spam behavior, review/dismiss/quarantine, timestamps, redaction, and CLI JSON; resolved reports leave the queue.

### CAN-107 — UI and machine transports own parallel application workflows

- Category: ownership
- Complexity: duplicated-capability
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: draft insertion is separately implemented in `releaseRouter.createDraft` and `machine-release.ts#createDraftReleaseForMachine`; release projections are independently assembled in `releaseRouter.listByGame`, `listOps`, `get-release-details.ts`, and `machine-release.ts`; media slot mapping/projection is repeated in `game-media.ts`, `machine-game-media.ts`, and `game-media-service.ts`; tRPC create/upload applies rate middleware while `/api/cli/**` invokes parallel machine functions without it.
- Current behavior: Low-level mutations are sometimes shared, but authorization, orchestration, policy, projections, and errors split by transport. Human and agent creators do not execute one canonical lifecycle.
- Architectural harm: A policy fix can protect one adapter and miss another; rate policy already differs. Repeated projections drift in privacy and fields, as CAN-105 demonstrates.
- Canonical end state: Actor-aware game/release/media application services own commands, queries, and stable projections. tRPC and machine HTTP remain auth/error adapters only.
- Change: Extract workflows from routers and `*ForMachine`; move quotas/rates/ownership there; define creator/ops/public projections; delete transport-specific business rules.
- Dependencies and blast radius: Tooling lane, SDK schemas, tRPC inference, auth, dashboards, CLI/MCP tests, and G1 API freeze.
- Validation: Adapter parity tests prove equivalent authorization, quotas, transitions, and results; mutation policy has one owner; duplicate searches are clean.

### CAN-108 — Release finalization is an undurable synchronous super-transaction

- Category: composition
- Complexity: accidental-complexity
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `release-artifact-service.ts#finalizeReleaseUpload` changes status, polls R2, downloads up to 100 MB into memory, parses, deletes a prefix, buffers/uploads up to 5,000 files sequentially, writes checks, connects to a browser, navigates/waits, stores/reads a screenshot, optionally calls OpenAI, and sets status before HTTP returns; tRPC and machine routes await it; no job table, lease, queue, worker command, concurrency gate, or stage replay exists.
- Current behavior: One request owns ingestion and moderation. Restart/timeout can interrupt between external writes and DB transitions; parallel callers start unbounded expensive work; clients receive no durable job identity or queue position.
- Architectural harm: The control plane is coupled to expensive failure-prone work and cannot satisfy the ratified browser/ingestion concurrency envelope or autonomous replay requirements.
- Canonical end state: Finalize enqueues one durable idempotent release job and returns status. Leased workers use bounded concurrency, persisted attempts/evidence, resume/cleanup, and explicit terminals. Publish stays separate.
- Change: Model jobs/stages; make expansion idempotent/content-addressed; add queue admission/inspection; move browser/moderation outside request lifetime; add safe retry/cancel/replay and events.
- Dependencies and blast radius: DB schema, worker topology, R2 keys, status model, browser/OpenAI, UI/CLI polling, quotas, and events.
- Validation: Kill/restart at every stage converges without duplication/stuck status; limits hold; clients receive stable job JSON; maximum artifacts stay within measured memory/time.

### CAN-109 — Ratified quotas and storage retention have no implementation owner

- Category: canonicality
- Complexity: contract-drift
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: the 1.0 roadmap ratifies game/listing/storage/submission/browser-job/concurrency allowances and 24-hour failed-upload cleanup; source searches find only object-size and transient IP limits; `archiveRelease` and `archiveGameMediaAsset` update PostgreSQL only; `ReleaseStorage.deletePrefix` is called only around extraction replacement/rollback; no scheduled cleanup or usage inspection exists. Readiness `G3-02` already broadly represents this work.
- Current behavior: Creators and agents can accumulate drafts, ZIPs, sites, screenshots, and media indefinitely. Database cascade/archive does not delete R2. Failed uploads have no lifecycle.
- Architectural harm: The free product has unbounded storage/job liability, cannot enforce its economic contract, and cannot reconcile database and physical storage ownership.
- Canonical end state: One usage/admission service measures creator/game/global use; one durable lifecycle owns temporary, failed, archived, and deleted object retention; limits run shadow-first as ratified with automatable protection.
- Change: Implement metering, inspection, admission, inventory reconciliation, tombstoned cleanup/retry, export/warning rules, and agent-operable preview/apply. Link rather than duplicate `G3-02`.
- Dependencies and blast radius: CAN-108, releases/media, R2 inventory/delete, export/deletion, events, budget controls, scheduling, and retention privacy.
- Validation: DB+R2 reconciliation matches; limits cover UI/machine; abandoned data expires; live releases stay protected; cleanup is idempotent; CLI reports use/limits/reset/repair.

### CAN-110 — Production schema migration is a manual hidden control plane

- Category: agent-operability
- Complexity: poor-ergonomics
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Resolution evidence: `platform database migration` now owns exact-target inspect, fingerprinted backup, immutable plan, guarded apply, and independent verify; generated schema identity gates platform readiness and worker claims; production migration policy and failure behavior are canonicalized in `docs/contracts/production-database-migration-contract.md`. Isolated restore remains separately tracked by `G3-03`.
- Current behavior: A human retrieves a public credential and remembers an ad hoc command around deploy. Agents cannot inspect, preview, apply with a backup gate, or verify compatibility through the repo CLI.
- Architectural harm: Code can deploy against the wrong schema or schema can change without recovery evidence. The real release procedure contradicts agent-first operations and its docs are stale.
- Canonical end state: Repo CLI owns migration inspect/plan/backup/apply/verify and documented recovery, with explicit production approval and target identity. Deploy follows a compatible migration sequence.
- Change: Add migration/status and restore verification to repo tooling; define approval and backup/restore evidence; remove or implement stale doctor docs; make deploy validation prove compatibility.
- Dependencies and blast radius: Backup/restore, Railway identity, migration journal, deploy, G3/G4/G7, and tooling conventions.
- Validation: An agent can replay inspect/backup/migrate/deploy/restore against production-like DB; wrong targets fail; interrupted scenarios have measured recovery; docs and help agree.

### CAN-111 — Runtime analytics tables have two hand-maintained Drizzle authorities

- Category: ownership
- Complexity: duplicated-capability
- Severity: medium
- Release classification: before-scale
- Confidence: high
- Evidence: `apps/platform/src/db/schema.ts` and `packages/server/src/db.ts` independently declare `app_ids` plus seven `runtime_usage_*` tables; platform declarations additionally own indexes; migrations live only under `apps/platform/drizzle/`; no contract test compares declarations; server writes its copy while platform reads the other.
- Current behavior: Platform is migration authority, but server compiles against a manually repeated subset. Changes require synchronized edits without an executable guard.
- Architectural harm: Producer and consumer can silently disagree despite typechecking. This is duplicate schema authority at the usage/accounting boundary.
- Canonical end state: One internal database-contract package owns shared physical tables/types; platform composes full schema/migrations and server imports only its shared subset. A generated verified contract is acceptable if it leaves one authority.
- Change: Extract or generate app-identity/runtime-usage schema; remove repeats; add migration/schema compatibility verification.
- Dependencies and blast radius: Runtime lane, server analytics/tests/scripts, platform reporting, Drizzle generation, package direction, Docker manifests, and CI.
- Validation: One source declares each table; both deployables import it; real-Postgres writer/reader integration passes; CI fails on drift.

### CAN-112 — Arcade lifecycle orchestration is concentrated in effect and ref synchronization

- Category: testability
- Complexity: excessive-indirection
- Severity: medium
- Release classification: before-scale
- Confidence: high
- Evidence: `apps/platform/src/components/arcade/arcade-system.tsx#ArcadeSystem` is 1,276 lines with 18 `useEffect` sites and coordinates replicated surface store, local runtime reducer, browser history, reconnect restore, localStorage preference, Socket.IO, input polling, settings, pings, and rendering; launch/close callbacks mirror through refs and two dependency suppressions exist; `GamePlayer` adds a 715-line dual-bridge lifecycle; tests cover helpers/guards but no launch/restore/popstate/exit component matrix.
- Current behavior: A valid game requires agreement among replicated kind/game, local URL/capability, browser path/history, server child session, and restore snapshot. Multiple effects/callbacks manually apply each transition.
- Architectural harm: Correctness depends on temporal React/ref freshness. Reconnect, back, failure, Strict Mode replay, and server close are hard to verify together; future agent lifecycle events add more paths.
- Canonical end state: One testable Arcade session orchestrator owns semantic connect/catalog/launch/ack/failure/restore/back/close/reset events and effects. Replicated state remains room authority; React renders snapshots and executes narrow IO.
- Change: Extract orchestration without inventing a competing state model; collapse launch/exit updates; isolate history/socket/persistence/bridge IO; split presentation; add scenarios first.
- Dependencies and blast radius: Runtime lane, SDK surface/restore, bridges, semantic sessions, Arcade UI, deep links, preview, and smoke tests.
- Validation: Deterministic scenarios assert server, replicated state, local capability, and URL convergence; core transitions need no dependency suppressions/callback refs; browser smoke stays unchanged.

### CAN-113 — Platform rate limiting is process-local and inconsistent across boundaries

- Category: boundary
- Complexity: duplicated-capability
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `server/api/rate-limit.ts` documents a single-instance in-memory `Map`; restart/replicas reset or multiply allowance; `server/api/trpc.ts#resolveClientIp` trusts first `x-forwarded-for` unconditionally while telemetry has a separate provider-aware identity; only selected tRPC mutations use middleware; machine routes and `reportPublic` bypass it.
- Current behavior: Rate policy depends on transport and process. Callers can choose unguarded paths, rotate identity depending on proxy behavior, or get fresh allowance after restart/scale-out.
- Architectural harm: It does not bound expensive free actions and creates false security confidence while duplicating request identity rules.
- Canonical end state: One trusted request-identity boundary and shared admission/quota service apply semantic policy across UI, machine, and public adapters. Approximate telemetry limiting may remain intentionally best-effort.
- Change: Centralize proxy-aware identity; move semantic limits into CAN-107 services; use PostgreSQL/Redis/provider controls based on measured scale; add structured retry/usage responses.
- Dependencies and blast radius: CAN-106 through CAN-109, Railway proxy contract, auth, machine APIs, telemetry, quota UI/CLI, and G5.
- Validation: Cross-adapter calls consume one allowance; restart/multi-instance cannot exceed global bound; spoofed forwarding headers cannot rotate identity; every expensive action returns the same structured limit error.

### CAN-114 — Managed-media active slots lack database integrity

- Category: boundary
- Complexity: unclear-ownership
- Severity: medium
- Release classification: before-scale
- Confidence: high
- Evidence: `games.thumbnailMediaAssetId`, `coverMediaAssetId`, and `previewVideoMediaAssetId` are nullable text without foreign keys; migration `0015_neat_butterfly.sql` adds no constraints; DB cannot ensure the asset exists, belongs to the game, has matching kind, or is ready; slot mapping repeats in media service, machine media, and media router.
- Current behavior: Services normally write valid IDs, but failures, migrations, CAN-103, or future writers can leave broken/cross-game/wrong-kind pointers. Public media then silently 404s.
- Architectural harm: A catalog invariant is only conventional despite multiple writers/readers. New media kinds require more columns and switches.
- Canonical end state: One active ready asset per game/kind is explicit and enforceable, preferably through an assignment relation keyed by `(game_id, kind)` with ownership/kind integrity.
- Change: Normalize assignments or add equivalent composite constraints; centralize projections/slot operations; migrate and delete mapping switches.
- Dependencies and blast radius: Schema/migrations, UI/machine API, catalog, URLs/cache, archive/finalize, and future kinds.
- Validation: PostgreSQL rejects cross-game/wrong-kind/missing assignment; concurrent assign/archive converges; catalog never emits invalid URLs; adapters share one mapping.

### CAN-115 — A complete documentation diagram is duplicated and dead

- Category: simplicity
- Complexity: obsolete-complexity
- Severity: low
- Release classification: before-scale
- Confidence: high
- Evidence: `apps/platform/src/components/docs/system-overview-diagram.tsx` and `apps/platform/src/components/docs/figures/system-overview-diagram.tsx` are 549/550-line copies with the same export; `diff -u` shows only import path and a figure-description attribute differ; complete consumer search finds only the figures copy imported by `content/docs/how-it-works/architecture/page.mdx`; all other diagrams live in `components/docs/figures/`.
- Current behavior: Two implementations describe the same architecture while only the accessible figures copy is live.
- Architectural harm: Architecture docs can be edited in the wrong file and drift; 549 dead lines obscure the canonical directory.
- Canonical end state: One accessible `SystemOverviewDiagram` lives with other figures.
- Change: Delete the root copy with no alias; retain the figures implementation only.
- Dependencies and blast radius: Docs build/generated content and a final consumer search.
- Validation: One implementation/export remains; content generation, platform typecheck/build, and architecture page render pass.

## R4 Resolution Evidence — 2026-08-28

The approved R4 authority cut is implemented in `f7eff9d..fb59754`:

1. `CAN-103`: generic release and media status mutations are deleted; transports
   expose only semantic lifecycle commands, guarded by a repo contract.
2. `CAN-104`: a partial unique index enforces one live release per game and the
   publish transaction serializes on the owning game row before replacing live
   state. Concurrent publish and direct-invalid-write PostgreSQL tests pass.
3. `CAN-107`: creator and operations actors enter shared release/media
   application services; tRPC and machine HTTP are protocol adapters over the
   same authorization, command, read-back, and projection workflows.
4. `CAN-111`: `@air-jam/database-contract` owns `app_ids` and all seven
   `runtime_usage_*` declarations; platform composes and migrates the contract,
   while the realtime server imports only the shared schema.
5. `CAN-112`: one stateless event/effect orchestrator plans room reset, launch,
   acknowledgement, failure, restore, history back, explicit close, and server
   child close. Replicated `arcade.surface` and the existing host-local runtime
   reducer remain the only state owners. Scenario tests and a visible local
   launch/back/relaunch smoke pass without launch/close callback refs.
6. `CAN-114`: active media is normalized into `game_media_assignments` with
   `(game_id, kind)` authority and ready/ownership/kind integrity. UI, machine,
   catalog, archive, finalize, and assign paths share one projection/service
   model; invalid and concurrent states are PostgreSQL-tested.

The implementation adds `+2,131 / -1,469` non-generated production and
operational lines, `+777 / -1` test/contract lines, and `6,170` generated
Drizzle snapshot lines. The positive source delta is the intended replacement
of conventional invariants and effect synchronization with explicit services,
database constraints, and deterministic scenarios; duplicate adapters and
schema declarations were removed in the same range.

No R4-scoped architecture debt remains. Distributed admission and rate-limit
authority (`CAN-113`) remains intentionally assigned to later Gate 3/5 work,
and R5 owns the complete clean-checkout matrix.

## Open Questions and Cross-Lane Dependencies

1. **Runtime/framework:** Can CAN-112 use the existing replicated surface and
   host-restore contracts without creating a competing state model?
2. **Runtime/framework:** CAN-111 needs a dependency direction that does not
   make the runtime domain or public SDK depend on the platform app.
3. **Tooling/public contracts:** CAN-107 needs exact intentional 1.0
   `platform-machine` schemas, including the report fields removed by CAN-105.
4. **Tooling/public contracts:** CAN-106 and CAN-110 need repo CLI conventions,
   structured JSON, production authority gates, and MCP parity where public.
5. **Security synthesis:** Cross-check CAN-100, CAN-102, CAN-105, and CAN-113
   against Gate 5. Verify production release-domain/token presence without
   printing secrets.
6. **Reliability synthesis:** CAN-101, CAN-108, and CAN-109 are coupled but
   distinct: static serving, durable processing, and quota/retention each need
   one owner. Decide parent/child readiness structure.
7. **Production evidence:** The repo proves unsafe fallbacks and missing
   invariants, not whether optional production variables are currently set.
8. **Intentional complexity:** Product telemetry justifies its ledger,
   projection, and contribution model with idempotency, privacy, repair, and
   retention. Do not collapse it without an invariant-preserving simplification.
9. **Deletion:** Re-run consumer searches immediately before deleting generic
   status mutations and the diagram; tRPC removal remains an intentional
   zero-compatibility cut even with no current UI consumer.
