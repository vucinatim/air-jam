# Air Jam Monorepo Operating System

Last updated: 2026-03-29  
Status: active

## Purpose

This document defines how work should be organized in the Air Jam monorepo so that:

1. there is one clear active ledger
2. plans stay bounded and current
3. architecture docs do not turn into task trackers
4. stale plans and random one-off files do not accumulate
5. coding agents and maintainers follow the same working model

The repo has outgrown the older assumption that one generic implementation plan file can track everything.
Air Jam now needs a cleaner split between:

1. architecture truth
2. active execution tracking
3. bounded system plans
4. follow-up backlog
5. archived history

## Canonical File Roles

### 1. Root Agent Contract

`AGENTS.md` defines repo-wide behavior expectations for humans and coding agents.

It owns:

1. engineering principles
2. documentation discipline
3. decision rules
4. required validation mindset

It does not own:

1. the active work queue
2. architecture details
3. system-plan execution detail

### 2. One Canonical Work Ledger

`docs/work-ledger.md` is the single active repo-wide execution ledger.

It owns:

1. the current release-critical path
2. active tracks and their status
3. links to the bounded plans that currently matter
4. the current view of what is done, in progress, blocked, or parked

It does not own:

1. deep implementation detail
2. architecture rationale
3. large historical notes

Rule:

1. if a repo-wide task matters right now, it must appear in `docs/work-ledger.md`

### 3. Architecture Truth

Core architecture docs stay stable and explain intended system shape.

Examples:

1. `docs/framework-paradigm.md`
2. `docs/systems/arcade-surface-contract.md`
3. `docs/systems/analytics-architecture.md`
4. `docs/systems/ai-native-development-workflow.md`

These documents should explain:

1. what the system is
2. who owns what
3. what boundaries are intended

They should not become daily checklists.

### 4. Bounded System Plans

`docs/plans/*.md` are for multi-step tracks with a clear boundary.

A plan is valid only when it has:

1. a concrete purpose
2. explicit scope
3. current status
4. exit criteria
5. a link from `docs/work-ledger.md`

Plans should answer:

1. what problem this track solves
2. what “done” means
3. what remains

Plans should not become duplicate work ledgers for the whole repo.

### 5. Backlog, Not Tracker

`docs/suggestions.md` is the durable follow-up backlog.

It owns:

1. important refactors
2. post-release hardening ideas
3. complexity-reduction follow-ups

It does not own:

1. the current execution queue
2. active critical-path status

### 6. Archived History

Completed or superseded plans move to `docs/archive/`.

If a document is no longer shaping current work, it should not stay mixed into the active plan surface just because it was once useful.

## The Working Model

The repo should always operate on this loop:

1. architecture docs define the intended system
2. `docs/work-ledger.md` defines what matters now
3. bounded plans define how a large track closes
4. `docs/suggestions.md` captures non-critical follow-ups
5. completed work gets archived instead of lingering half-active

## Default Execution Loop

This is the default day-to-day execution loop for work in this monorepo.

### 1. Pick Scope

1. Pick one active item from `docs/work-ledger.md`.
2. Define acceptance behavior before touching code.
3. Confirm whether it is launch-blocking or acceptable post-release.
4. For critical networking, security, or trust-boundary paths, define the validation approach first.
5. If the work belongs to a bounded active track, open the relevant plan from `docs/plans/`.

### 2. Implement Minimal Changes

1. Prefer the smallest safe change that solves the problem.
2. Do not add abstractions unless they clearly reduce complexity.
3. If the fix requires architecture changes, document the boundary and keep the first patch incremental.

### 3. Add Or Update Tests

1. Add regression tests for every security or trust-boundary fix.
2. Add or update integration tests for socket flows when behavior changes.
3. Keep tests focused on observable behavior, not internals.
4. For server-critical paths, include correctness and stability checks, plus performance sanity when relevant.

### 4. Run Required Gates

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build`
5. When touching networking or perf-sensitive server paths, run `pnpm run repo -- perf sanity` when relevant.

### 4.5. Debugging Order

When behavior is unclear across the server, browser runtime, controller, Arcade shell, or workspace tools:

1. start with `pnpm exec air-jam-server logs --view=signal`
2. narrow with `--trace`, `--room`, `--controller`, `--runtime`, `--process`, or `--source`
3. only add temporary ad hoc logging if the unified stream still leaves a real gap

`pnpm run repo -- workspace logs` is only a maintainer convenience passthrough to the same canonical reader.

### 5. Template And Scaffold Validation

When touching `create-airjam`, scaffoldable games, or package-boundary behavior:

1. Keep `games/` as the source of truth for scaffoldable game templates.
2. Keep Air Jam-specific Vite defaults centralized in `create-airjam/runtime/vite-config.mjs`; only add per-game Vite overrides when a game has a real runtime need.
3. Do not rely on publish-time mutation of template dependencies or Vite config.
4. Validate scaffoldable games with `pnpm test:scaffold`.
5. Validate unpublished-package behavior with `pnpm test:scaffold:tarball`.
6. If you need local artifacts for another repo, use `pnpm run repo -- pack local`.

### 6. Legacy Game Migration Proof

When touching SDK/server package-consumer behavior or the release migration proof:

1. Validate the legacy ZeroDays games with `pnpm run repo -- legacy validate-tarball --root /absolute/path/to/air-jam-games` or set `AIRJAM_LEGACY_GAMES_ROOT`.
2. Treat failures there as real package-surface regressions, not as optional external-app noise.
3. Keep the reusable migration recipe in `docs/systems/legacy-game-migration-guide.md`.

### 7. Secure Local Arcade Validation

When touching shared secure-dev behavior, local Arcade launch paths, or generated game dev scripts:

1. treat `mkcert`-backed local HTTPS as the canonical path
2. keep the repo workflow split explicit across three modes:
   `pnpm dev -- --game=<id>` is hybrid workspace dev: sdk watch, server, platform, and the selected game's direct Vite dev server
   `pnpm arcade:test -- --game=<id>` is built local Arcade integration validation
   `cd games/<id> && pnpm dev -- --secure` is standalone secure game dev for browser APIs outside the built Arcade route
3. keep `pnpm arcade:test -- --game=<id> --secure` as the stable secure Arcade integration path
4. keep exported projects on the direct secure-game contract (`pnpm secure:init` plus `pnpm dev -- --secure`)
5. keep Cloudflare tunnel support explicit fallback only, not the default docs path
6. validate scaffolded secure-dev contract changes with `pnpm test:scaffold`

### 8. Database Modes

Keep the repo DB stories explicit:

1. `pnpm run repo -- db up` manages the optional persistent local dev Postgres
2. its data lives under `.airjam/postgres/dev/`
3. destructive analytics tests must never rely on the shared runtime `DATABASE_URL`
4. destructive analytics tests should use the dedicated analytics test DB path
5. prerelease may intentionally continue using a production-connected `DATABASE_URL`, but that should stay an explicit maintainer choice rather than an accidental default forever

Operationally:

1. before release, it is acceptable for `apps/platform/.env.local` and `packages/server/.env` to keep `DATABASE_URL` pointed at the production-connected database intentionally
2. when switching normal development to local Postgres, boot it with `pnpm run repo -- db up`
3. print the connection string with `pnpm run repo -- db url`
4. copy that value into the package env files that own `DATABASE_URL`
5. restart the affected processes after changing env values
6. use `pnpm run repo -- db reset` when you intentionally want a clean local database

### 9. Update Docs In The Same Change

1. Update affected docs immediately when contracts or behavior change.
2. Keep `docs/work-ledger.md` as the single active repo-wide execution ledger.
3. Keep completed reset or migration summaries in `docs/archive/` with explicit names.
4. Archive detailed completed plans under `docs/archive/`.
5. Track non-launch architecture follow-ups in `docs/suggestions.md`.

### 10. Merge Discipline

1. Keep changes small and single-purpose when practical.
2. Include what changed, why, and validation evidence.
3. During prerelease work, prioritize release-critical completion over broad unrelated refactors.

## Rules For Starting Work

Before substantial work:

1. read `AGENTS.md`
2. read `docs/work-ledger.md`
3. read the relevant architecture doc(s)
4. read only the bounded plan(s) that actually apply

If the work is:

1. small and local
   1. update the ledger only if repo-level status changes
2. a multi-step track
   1. create or reuse one bounded plan
   2. add it to the ledger immediately
3. just a future improvement
   1. put it in `docs/suggestions.md`

## Rules For Creating A New Plan

Create a new plan only when the work:

1. spans multiple sessions
2. has multiple acceptance steps
3. affects more than one package or boundary
4. would become unclear if tracked only in the ledger

Do not create a plan for:

1. a one-file fix
2. a small focused refactor
3. a simple docs update
4. a follow-up that belongs in `docs/suggestions.md`

## Rules For Updating Plans

Whenever a plan is touched materially:

1. update its `Last updated` date
2. update its `Status` if it changed
3. remove completed items instead of letting them linger as implicit TODOs
4. reflect the same status change in `docs/work-ledger.md`

If a plan’s remaining work becomes trivial:

1. fold the remainder into `docs/work-ledger.md`
2. archive the plan

## Content Contribution Rules

When a change touches public content or framework contracts:

1. Put public framework docs content in `content/docs/`, not under `apps/platform/src/app/docs/`.
2. Put public blog content in `content/blog/`, not under the Next app tree.
3. Keep page-local metadata in neighboring `page.docs.ts` and `post.meta.ts` files and treat that metadata as canonical.
4. Treat `apps/platform/src/features/docs/` and `apps/platform/src/features/blog/` as the runtime delivery boundaries for those content systems.
5. Do not edit generated content source files under `apps/platform/src/features/*/generated/` directly; regenerate them through the platform content scripts.
6. Put maintainer-only docs, plans, and architectural notes in root `docs/`.
7. Update content tests, manifests, and routes in the same change when public docs or blog behavior changes.

## Stale Plan Prevention Rules

These are mandatory.

### 1. No Duplicate Active Tracker

`docs/work-ledger.md` is the only repo-wide active ledger.

No other file should pretend to be the current overall task tracker.

### 2. No “Active” Plan Without Ledger Entry

If a plan is marked active, it must appear in `docs/work-ledger.md`.

### 3. No Completed Plan In The Active Surface

If a plan is done or superseded:

1. archive it
2. remove it from the active docs index section
3. keep only a short pointer if historical context still matters

### 4. No Architecture Doc As Task Dump

Architecture docs should not carry growing implementation punch lists.

### 5. No Random Repo Notes

Maintainer notes that affect current work belong in one of:

1. `docs/work-ledger.md`
2. a bounded plan in `docs/plans/`
3. `docs/suggestions.md`
4. `docs/archive/`

If a note fits none of those, it probably should not be a permanent doc.

## Suggestion Usage Rule

`docs/suggestions.md` should only contain follow-ups that are:

1. real enough to matter later
2. not on the current critical path
3. too important to lose in chat history

It should not contain:

1. active checklist work
2. temporary investigation notes
3. vague brainstorming with no likely next step

## Suggested Status Vocabulary

Keep statuses simple and consistent:

1. `active`
2. `mostly complete`
3. `blocked`
4. `parked`
5. `completed`

Avoid inventing new status labels casually.

## Monorepo Package Boundary Guidance

When working in this repo, maintainers and agents should think in these ownership layers:

1. `packages/sdk`: reusable framework/runtime primitives
2. `packages/server`: runtime invariants, transport, diagnostics, policy
3. `packages/create-airjam`: scaffold, template system, AI pack, generated-project DX
4. `apps/platform`: first-party product shell, docs/blog delivery, arcade/browser/controller UX
5. `games/air-capture`: reference game and real framework proof
6. `content/docs` and `content/blog`: canonical public content sources
7. `docs/`: maintainer-only architecture, plans, and internal operating docs

Any change that crosses those boundaries should say so explicitly in the plan or ledger.

## Agent Workflow Rules

When a coding agent works in this repo, it should:

1. start from `AGENTS.md`
2. use `docs/work-ledger.md` as the first execution checkpoint
3. read only the specific architecture and plan docs needed for the task
4. update docs in the same change when contracts or status change
5. propose archive/move/delete actions when docs have clearly gone stale

Agents should prefer deleting stale plan surface over preserving every historical note in active docs.

## Immediate Repo Policy Change

The monorepo should now use:

1. `docs/work-ledger.md` as the single active repo-wide ledger
2. `docs/plans/*.md` only for bounded tracks
3. `docs/archive/` for completed summaries, detailed trackers, and historical plans

That is the intended working system going forward.
