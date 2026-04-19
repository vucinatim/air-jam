# Air Jam Project Review — 2026-04-15

Snapshot review of the whole project: idea, architecture, implementation, and the list of things that will hurt later if we don't at least mark them now.

## About this document

1. This is a **one-off evaluation snapshot**, not a plan and not a backlog.
2. **Execution source of truth is [`docs/work-ledger.md`](../work-ledger.md).** When this review disagrees with the ledger, the ledger wins. Some concerns in this snapshot were already resolved in ledger entries and are kept here only as a historical read.
3. Action items derived from this review land in [`docs/suggestions.md`](../suggestions.md) (durable follow-ups) or [`docs/plans/`](../plans/) (active multi-step tracks) — not here.
4. This doc has been through one internal review pass; staleness corrections and framing tightenings from that pass are folded in.

Scale assumptions this review is written against:

1. short horizon: up to ~100 concurrent rooms, ~10–20 third-party game devs in the first few months
2. product is free at launch; monetization deferred until we have 100–1000 active users
3. single-instance server is acceptable for the near term
4. third-party games are reviewed/approved manually before landing in the public arcade

Those assumptions change which missing pieces are release-blocking vs later-on-ramp.

---

## 1. Executive summary

**Grades**

| Dimension                       | Grade |
| ------------------------------- | ----- |
| Idea                            | A−    |
| Architecture (macro)            | A     |
| Architecture (meso)             | B     |
| SDK implementation              | B     |
| Server implementation (1 box)   | B+    |
| Server implementation (N boxes) | C−    |
| Platform implementation         | B−    |
| Games + scaffolding             | B+    |
| Docs / ops discipline           | A−    |
| Production readiness today      | C+    |
| Production readiness post-list  | B+    |

**Code size (non-test, non-generated):** roughly 93k LOC — SDK ~17.8k, server ~8.3k, platform ~32.2k, games ~35k.

**One-line verdict.** The protocol, server core, and docs discipline are above-average for this stage. Pain mostly concentrates in (a) speculative SDK surface area that has no first-party consumer yet and (b) a handful of oversized internal modules. Ops essentials (error tracking, real `/health`, basic abuse protection) are the main release-time risk — everything else can wait until there is actual traffic.

---

## 2. The idea

1. Clear product thesis: "AirConsole for the open web" — TVs/laptops host, phones are controllers via QR, no app install. Real, underserved niche (party games, installations, classrooms).
2. Moat shape is right: the winning asset isn't a single game but the catalog + SDK + shared controller runtime.
3. Vision (`docs/vision.md`, `AGENTS.md`) is internally consistent with the code — the "AI-native game creation harness" is a plausible long-term extension of today's architecture, not a bolt-on fantasy.
4. Taste signals: three-lane model (input / state / signal), Zod everywhere, clean v2 handshake, per-handler authorization policies, real perf sanity in CI, unified dev-log stream.

Weakness in the story: monetization and moderation are unstated. Deferred is fine; but the first version of each needs to exist as a design note before either becomes urgent.

---

## 3. Architecture

### 3.1 Where it's right

1. Monorepo split is clean: `packages/sdk`, `packages/server`, `packages/create-airjam`, `apps/platform`, `games/*`. Boundaries are respected.
2. Server layering is textbook: transport (`gateway/`) vs domain (`domain/room-session-domain.ts`) vs services (`auth-service.ts`, `rate-limit-service.ts`, `room-manager.ts`) vs policies (`rate-limit-policy.ts`, `socket-authorization.ts`).
3. Protocol layer (`packages/sdk/src/protocol/`) is disciplined — small, Zod-validated, versioned (`contracts/v2/`), explicit socket event enums.
4. Iframe embedding is carrying real weight for a real reason — the explicit 8-field runtime topology contract (`appOrigin`, `backendOrigin`, `socketOrigin`, `publicHost`, `assetBasePath`, `runtimeMode`, `surfaceRole`, `proxyStrategy`) is the correct shape for embedding untrusted games inside a platform shell.

### 3.2 Where the architecture is carrying weight it shouldn't

1. **Experimental SDK subpath exports need individual ownership review.** The SDK publishes `/preview`, `/runtime-control`, `/runtime-inspection`, `/runtime-observability`, `/capabilities`, `/prefabs`, `/contracts/v2`, `/arcade/bridge/{host,controller,iframe}`, `/ui`, `/protocol`. The ledger ([`docs/work-ledger.md:115`](../work-ledger.md)) confirms these are deliberate experimental leaves, and `packages/sdk/README.md:281` marks them as "experimental and intentionally unstable." That's the right posture. The concern is narrower: each leaf should pass a three-part test — **clear owner, explicit experimental status, and a real near-term purpose beyond speculative surface area**. Leaves that fail the third part are carrying versioning and documentation weight without justified product or architecture benefit. Audit individually; do not collapse under one generic bucket.
2. **Parallel runtime-wiring paths — a bounded smell, not structural rot.** Supporting standalone, embedded, host, controller, preview, and platform surfaces is a legitimate source of structural complexity. Separately, the defensive `useClaimSessionRuntimeOwner()` scope machinery in `context/session-scope.ts` is specifically defending against _ambiguous ownership_, which is a different concern. Keep this alive as a smell to revisit when next doing runtime-ownership work; don't treat it as prerelease cleanup.
3. **Duplicate URL builders / settings-inheritance paths — mostly resolved per ledger.** [`docs/work-ledger.md:211–213`](../work-ledger.md) records that the SDK-owned platform-settings boundary cleanup and the canonical preview URL builder are complete. If any duplication remains after that work, it's residual; verify against the ledger before acting. The remaining state-access hooks (`useAirJamHostState`, `useHostSession`) are still observably present in the current tree and worth a later deduplication pass.

---

## 4. Implementation

### 4.1 SDK — solid core, internal god hooks

**Red flags**

1. [`packages/sdk/src/hooks/internal/use-host-runtime-api.ts`](../../packages/sdk/src/hooks/internal/use-host-runtime-api.ts) — **918 LOC**
2. [`packages/sdk/src/hooks/internal/use-controller-runtime-api.ts`](../../packages/sdk/src/hooks/internal/use-controller-runtime-api.ts) — **749 LOC**

   Both handle socket lifecycle, room create/join, state hydration, event subscriptions, arcade restore, input bridging, and reconnect in one closure. Public hooks (`use-air-jam-host.ts` 250, `use-air-jam-controller.ts` 206) are thin facades. These are the files most likely to host future Heisenbugs.

3. [`packages/sdk/src/dev/browser-log-sink.ts`](../../packages/sdk/src/dev/browser-log-sink.ts) — **879 LOC** for a log sink. Entire product inside the SDK.
4. [`packages/sdk/src/runtime/air-jam-error-boundary.tsx`](../../packages/sdk/src/runtime/air-jam-error-boundary.tsx) — **659 LOC**. Error boundaries should be ~50 LOC; this one has absorbed runtime-status-shell work.
5. `AirJamActionContext` **may not verify actor role or membership** — handlers might not be able to safely assume anything about the caller. **Needs a direct server/runtime audit before promoting to a fix.** Review-only claim; do not action without verification against the current action-dispatch path.

**What's genuinely good**

1. Zod protocol with a proper v2 handshake path.
2. 49 test files covering unit and behavior paths.
3. Dual-format tsup build, correct `external`, treeshake enabled, dev-time SDK version injection.
4. Session-scope claims catching misuse at runtime.

### 4.2 Server — excellent for one box, not yet multi-box

**What's right**

1. Clean FSM transitions (`ROOM_LIFECYCLE_TRANSITIONS` in `domain/room-session-domain.ts`).
2. Consistent Zod `safeParse` in every handler.
3. Per-handler authorization.
4. Real reconnect grace periods (host 3s, controller 30s).
5. Configurable TTLs for testability.
6. Integration tests covering host/controller lifecycle, routing-security, churn, state-sync, auth + rate limits.
7. Strict server perf sanity with reconnect churn gated in CI (`pnpm check:release`).

**What will break as soon as we go multi-instance**

1. No `socket.io-redis` adapter — rooms created on instance A not visible to instance B.
2. All room state in a single in-process `Map` (`services/room-manager.ts`).
3. Rate-limit counters in-memory (each instance has its own window).
4. Analytics writes synchronous on the event path with projections + aggregations in a transaction (`analytics/runtime-usage-ledger.ts`).

**Production essentials missing**

1. `/health` returns `{ok:true}` only — no room count / DB ping / backlog.
2. No Prometheus / OTel / Sentry-equivalent.
3. No graceful drain on shutdown.
4. No Express payload size limit.
5. No per-room rate limits (only per-IP).
6. No app-ID cache — every bootstrap does a DB round trip.
7. No grant revocation / rotation story.

### 4.3 Platform — biggest surface, most spaghetti risk

1. [`apps/platform/src/components/arcade/arcade-system.tsx`](../../apps/platform/src/components/arcade/arcade-system.tsx) — **1139 LOC** mixing browser state, player state, and runtime session state. Primary crash site for any future UX redesign.
2. [`apps/platform/src/components/controller-menu-sheet.tsx`](../../apps/platform/src/components/controller-menu-sheet.tsx) — **980 LOC** in one modal.
3. Three parallel local-build route trees: `src/app/__airjam/`, `src/app/__airjam-local-builds/`, `src/app/airjam-local-builds/`. Only the last is live. Delete the other two.
4. No rate limiting on tRPC — `release.createDraft`, `game.create`, sign-up are all unthrottled.
5. No index on `games.user_id` in `apps/platform/src/db/schema.ts` — will be the most common query.
6. `games.config` JSONB has no schema validation — will accumulate an unmigratable long tail.
7. `apps/platform/src/features/` is only docs + blog; feature-domain business logic is scattered between `lib/` and `server/`.

**What's right**

1. Real tRPC `protectedProcedure` / `opsProcedure` middleware.
2. Proper cascade FKs and indexes on hot paths.
3. 18 numbered Drizzle migrations.
4. Build-time doc/search-index generation, artifacts not committed.
5. BetterAuth integration is clean.
6. Release streaming (`/releases/g/.../[...assetPath]`) is the right shape.

### 4.4 Games + scaffolding — canonical pattern, one outlier

1. Entry points (`main.tsx` → `airjam.config.ts` → `app.tsx` with `airjam.Host` / `airjam.Controller`) are **uniform across all five games** — good validation that the SDK shape is right.
2. Pong is the true canonical starter (~400 LOC game logic, 8 test files).
3. Air-capture is a hybrid reference game + SDK stress test + dev harness. The prefab-preview subsystem (`games/air-capture/src/prefab-preview/` + conditional routing in `src/app.tsx`) is dev tooling leaking into the game — should live in `@air-jam/visual-harness` or a dedicated harness app.
4. code-review, the-office, and last-band-standing have thinner test coverage than pong and air-capture — not "no tests," just less depth.
5. No shared `@air-jam/game-template` helper package yet — boilerplate for input schema / store / session setup is duplicated per game. **Do not abstract early.** Wait for two or three repeated pain points before introducing a shared helper; per-game ownership of these is a feature, not a defect.
6. Per-game input schemas are correct and expected. Different games should own different inputs. Introduce shared factories only for patterns that repeat with obvious duplication.
7. Scaffold pipeline (`packages/create-airjam/`) is sound — source games are the template source of truth, normalization at pack time, manifest-driven version pinning.
8. Repo CLI (`scripts/repo/cli.mjs`) is justified today. Revisit around 10+ games or multiple contributors — standard tooling (Nx / Turbo) will be cheaper than maintaining bespoke orchestration forever.

### 4.5 Docs + ops — disproportionately strong

1. 47+ items in `docs/archive/`, 4 live plans in `docs/plans/`, crisp `docs/work-ledger.md`, prioritized `docs/suggestions.md`.
2. CI runs `check:release` = typecheck + test + build + **strict** perf sanity + smoke — above median for OSS projects at this age.
3. Env validation via Zod in `server-env.ts`.
4. Release is manual `workflow_dispatch` — fine for a coordinated v1; adopt changesets for steady cadence later.

---

## 5. Overcomplications / spaghetti — concrete list

1. **Audit experimental SDK subpath exports for justified ownership and real use.** Each of `/preview`, `/runtime-control`, `/runtime-inspection`, `/runtime-observability`, `/capabilities`, `/prefabs` should pass the three-part test: clear owner, explicit experimental status, real near-term purpose. Keep the explicit naming; drop or defer any leaf that fails the third part. Do **not** collapse them under a generic `/experimental` bucket — that loses signal.
2. Two god hooks: `use-host-runtime-api.ts` (918) and `use-controller-runtime-api.ts` (749). Split into connection / state / events / input-bridge / arcade-restore pieces. **Refactor debt, not launch-blocking** — do when next touching runtime code.
3. `browser-log-sink.ts` (879) and `air-jam-error-boundary.tsx` (659). Trim, relocate, or gate behind dev-only. **Refactor debt, not launch-blocking.**
4. Near-duplicate state-access hooks (`useAirJamHostState`, `useHostSession`). Verify against the ledger, then dedupe whatever remains.
5. URL builder / settings-inheritance duplication was largely resolved per [`docs/work-ledger.md:211–213`](../work-ledger.md). Verify before acting further.
6. `arcade-system.tsx` (1139) and `controller-menu-sheet.tsx` (980). Split by concern. **Refactor debt, not launch-blocking.**
7. Three `__airjam*` / `airjam-local-builds` route trees in the platform. Only one is live — delete the rest.
8. Prefab-preview harness lives inside a shipping game. Extract.

None of this is catastrophic. All of it is the shape of a project that refactored fast and hasn't yet swept the deprecation aisle.

---

## 6. Missing pieces by horizon

### 6.1 Will hurt within weeks of a real launch (even at <100 concurrent rooms)

1. No Sentry / error tracking anywhere.
2. `/health` is a no-op — no readiness probe, no room-count / backlog gauge.
3. No payload size limit on Express (default 100KB — easy footgun).
4. tRPC endpoints unthrottled (`release.createDraft`, `game.create`, sign-up).
5. No CSP / security headers audit on the platform; iframe embedding surfaces need this before third parties land.
6. Analytics writes on the realtime hot path in a DB transaction — at 100 rooms still fine, but it's a ticking item.
7. No admin kill-switch / maintenance mode.

### 6.2 Will hurt at ~1k concurrent rooms

1. Single-process server; no `socket.io-redis` adapter; no sticky-session LB story.
2. In-memory rate limits bypassable by round-robin LB.
3. No app-ID cache — bootstrap storms hit the DB.
4. No graceful drain on shutdown (in-flight analytics lost on redeploy).
5. No Prometheus / OTel.
6. No per-room rate limits (only per-IP).

### 6.3 Will hurt once a real game library + third-party creators exist

1. **No structured game manifest.** Category, min/max players, input modality, age rating, maintainer, supported SDK range should live in an `airjam-game.json` validated by Zod. Today the platform uses an un-schema'd `games.config` JSONB. This is the single highest-leverage schema decision for the catalog era — define it early.
2. **No SDK v1→v2 compatibility story.** Games pin `@air-jam/sdk` to whatever workspace version shipped with their release. When v2 lands, there's no `supportedSdkRange`, no codemod, no v1 compat adapter.
3. **No sandbox quotas for third-party games.** They run in iframes (good) but with no CSP allowlist per game, no runtime quotas, no kill switch for a specific game.
4. **No moderation dashboard.** Server-side checks exist in `release-moderation-service.ts`, but there's no ops UI to review flagged releases. Today it's "trust every creator."
5. **No first-party asset storage.** README says "URL-based for v1" — fine now, but by ~10 published games the catalog will look broken from third-party 404s and mixed-content.
6. **No analytics funnels.** Sessions and events are tracked, but no cohort view, no per-game scan→join→first-input→return funnel, no creator-facing dashboard.
7. **No monetization hooks.** Not a blocker, but without any hook, the day we need it we'll retrofit across every table.
8. **No feature-flag system.** Homegrown against the existing Postgres is enough; worth having before public launch for safe rollouts.

### 6.4 Will hurt the AI-Studio vision specifically

The `capabilities` / `runtime-observability` / `runtime-control` leaves are already explicitly marked as experimental and intentionally unstable in [`packages/sdk/README.md:281`](../../packages/sdk/README.md) — that half of the concern is resolved. What remains open is that no first-party agent-facing consumer exercises them yet, so they can drift relative to the real runtime without anyone noticing. Ship a small first-party consumer (bot / smoke driver / synthetic player) when a concrete agent-tooling use case lands. Not urgent; worth marking so it isn't forgotten.

---

## 7. Action buckets

Scoped to our actual near-term: up to ~100 concurrent rooms, 10–20 third-party devs, free at launch, monetization deferred to 100–1000 active users. Four buckets: **Do now**, **Do soon**, **Later**, **Reject**. Plus a **Needs audit** row for claims that should be verified before being promoted to any of the first four.

Items in Do now should land on [`docs/plans/`](../plans/) or [`docs/work-ledger.md`](../work-ledger.md) once prioritized. Items in Later should land in [`docs/suggestions.md`](../suggestions.md) so they aren't forgotten.

### 7.1 Do now — must-do before public launch

These are the items where "fix later" means either migrating user data, breaking third-party games, an unrecoverable launch-day incident, or silent data-shape spread.

1. **Sentry (or equivalent) in platform, server, and SDK browser runtime.** Launch-day bugs are invisible otherwise.
2. **Real `/health` endpoint** — DB ping, room count, uptime. Verified weak at [`packages/server/src/index.ts:162`](../../packages/server/src/index.ts).
3. **Express payload size limit.** Verified missing at [`packages/server/src/index.ts:160`](../../packages/server/src/index.ts). One line.
4. **tRPC abuse guard on write paths** — sign-up, `game.create`, `release.createDraft`, `gameMedia.*`. In-process counter is fine at this scale.
5. **Delete dead route trees** — `apps/platform/src/app/__airjam/` and `apps/platform/src/app/__airjam-local-builds/`. Only `airjam-local-builds/` is live.
6. **Kill-switch / maintenance-mode toggle.** DB flag or env var that blocks new host bootstraps. Required the first time a Reddit post brings 500 people and something is wrong.
7. **Security header audit** on platform responses (CSP, frame-ancestors tuned for the embed model, Referrer-Policy, Permissions-Policy). Pass through `helmet` defaults as a baseline.
8. **SDK v1→v2 compatibility policy paragraph** in the docs. Gives third-party devs a floor to build against.
9. **Manual first-party game review pre-publish.** A human approves every release before it appears in the public arcade. Existing release-moderation pipeline already logs.
10. **Add `games.user_id` index** in [`apps/platform/src/db/schema.ts:80`](../../apps/platform/src/db/schema.ts). Cheap; will be the most common query.
11. **Zod validation at the write boundary for `games.config` JSONB** ([`apps/platform/src/db/schema.ts:96`](../../apps/platform/src/db/schema.ts)). Prevents silent data-shape spread before any dev ships against an un-schema'd field.

Estimate (one person, realistic): **1–2 weeks of focused work.**

### 7.2 Do soon — post-launch but near-term, before external creator onboarding

1. **Typed canonical game metadata contract** before external creator onboarding. Category, min/max players, input modality, supported SDK range, maintainer. Does not need to be a literal `airjam-game.json` — the shape matters, the filename doesn't. Lock the contract before third-party devs ship 20 games against it.
2. **Extract prefab-preview out of `games/air-capture`** (verified leak at [`games/air-capture/src/app.tsx:7`](../../games/air-capture/src/app.tsx)). Either into `@air-jam/visual-harness` or a dedicated harness app. Don't ship dev tooling inside a shipping game.
3. **Host-grant revocation / rotation story.** Important once grant usage is a real external contract.
4. **CSP allowlist per embedded game.** As the catalog grows beyond first-party-only.
5. **Audit experimental SDK subpath exports individually** against the three-part test (owner + experimental status + real near-term purpose). Keep the named leaves; drop or defer any that fail the third part.
6. **Reconcile residual URL-builder / state-hook duplication claims** against [`docs/work-ledger.md:211–213`](../work-ledger.md) and dedupe whatever actually remains.
7. **Revisit parallel runtime-wiring paths** when next doing runtime-ownership work. Not a prerelease pass on its own.

### 7.3 Later — defer until traffic, library pressure, or operational signal demands it

Put these in [`docs/suggestions.md`](../suggestions.md) so they aren't lost.

1. `socket.io-redis` + sticky LB when one instance isn't enough.
2. Prometheus / OpenTelemetry — logs + Sentry are enough at this scale.
3. Analytics queue / batching — sync writes are fine up to a few hundred rooms.
4. Per-room rate limits.
5. Moderation ops dashboard UI — manual approval suffices for the first dozen creators.
6. First-party asset storage / CDN — URL-based works up to ~10 published games.
7. Sandbox quotas for third-party games.
8. Monetization hooks — revisit at 100–1000 active users.
9. Feature-flag system — add when the first risky rollout demands one.
10. Split god hooks (`use-host-runtime-api.ts`, `use-controller-runtime-api.ts`) into concern-level pieces. Refactor debt, not launch-blocking.
11. Trim `browser-log-sink.ts` and `air-jam-error-boundary.tsx`. Refactor debt.
12. Split `arcade-system.tsx` and `controller-menu-sheet.tsx`. Refactor debt.
13. Shared `@air-jam/game-template` helper package — only after two or three repeated pain points.
14. Analytics funnels / creator dashboards.
15. Changesets-driven release flow once cadence increases.
16. App-ID cache with short TTL on bootstrap path.
17. Graceful drain on shutdown.
18. Ship a first-party agent / bot consumer for the experimental runtime leaves when a concrete use case lands.

### 7.4 Reject — not the right move

1. **Collapse experimental SDK leaves under a single `/experimental` bucket.** Loses signal. The named leaves are a deliberate, documented taxonomy ([`docs/work-ledger.md:115`](../work-ledger.md)). Audit individually; don't collapse.
2. **Force input-schema uniformity across games.** Different games should own different inputs. Shared factories only for obvious repeated patterns.
3. **Introduce `@air-jam/game-template` prerelease.** Too early. Wait for repeated pain.
4. **Build multi-instance infrastructure prerelease.** Explicit one-box acceptance near-term.
5. **Ship monetization plumbing prerelease.** Not where prerelease time belongs.

### 7.5 Needs audit — verify before promoting to Do now / Do soon

1. **`AirJamActionContext` actor-role / membership verification.** Review-only claim; requires a direct audit of the action-dispatch path in server + SDK before it's promoted into the action buckets. If the claim holds, it's a correctness fix, not a refactor.

---

## 8. Bottom line

This project is genuinely above-average for its stage — clean protocol, disciplined server layering, exceptional docs discipline, real perf gates in CI, a coherent product thesis. The costs it's paying right now are **ops hardening gaps**, **a handful of oversized internal modules**, and **subpath exports that need individual ownership review** — all fixable without rewriting anything.

For the near-term launch profile (≤100 rooms, 10–20 devs, free), the §7.1 "Do now" list is the right floor. §7.2 is the near-term on-ramp before external creator onboarding. §7.3 belongs in [`docs/suggestions.md`](../suggestions.md) so nothing is lost. §7.4 rejects are the moves that would cost more than they'd buy. §7.5 is the one claim in this review that should be verified before being acted on.

The execution source of truth for any of this is [`docs/work-ledger.md`](../work-ledger.md); when the ledger disagrees with this snapshot, the ledger wins.
