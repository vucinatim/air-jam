# Air Jam Work Ledger

Last updated: 2026-03-29  
Status: active

This is the single active repo-wide ledger.

Use it to answer:

1. what matters now
2. what is already done
3. which active plans still matter
4. which tracks should be archived or collapsed

## Current Execution Order

Air Jam should move through prerelease work in this order:

1. finish release workflow and CI hardening
2. add one browser-level product-proof smoke path
3. complete migration proof on the legacy games
4. finish only the remaining release-facing polish that materially improves credibility
5. prepare the release PR and publish

Anything outside that order should only move in parallel when it does not slow the critical path.

## Release-Critical Path

### Priority 1. Release Workflow And CI Hardening

Status: completed baseline  
Plan: [Release Prep Plan](./plans/release-prep-plan.md)

Completed:

1. package publish targeting is explicit
2. CI now enforces the canonical release contract
3. release-visible platform browser console noise was removed from arcade/controller-facing runtime paths

### Priority 2. Browser-Level Product Proof

Status: completed baseline  
Plan: [Release Prep Plan](./plans/release-prep-plan.md)

Completed:

1. one true browser-level host/controller/join/launch smoke path now runs inside `pnpm check:release`
2. the smoke path uses a deterministic local Arcade reference game instead of database-seeded public content

### Priority 3. Migration Proof

Status: completed baseline  
Plan: [V1 Closeout Plan](./plans/v1-closeout-plan.md)

Completed:

1. the concrete migration guide now exists in [Legacy Game Migration Guide](./systems/legacy-game-migration-guide.md)
2. the three legacy ZeroDays games are already on the current bootstrap and route model
3. repo-owned local tarball validation now proves `code-review`, `last-band-standing`, and `the-office` against packaged SDK/server dependencies via `pnpm test:legacy:tarball`

### Priority 4. Release-Facing Product Polish

Status: active  
Plan: [Release-Facing Polish Plan](./plans/release-polish-plan.md)

Remaining:

1. keep only small Pong/reference quality passes that improve release credibility
2. defer the `air-capture` template-aligned refactor until the end of prerelease polish instead of continuing piecemeal changes
3. move anything else non-essential to `docs/suggestions.md`

Rule:

1. do this in parallel only when it does not delay priorities 1 through 3
2. move anything non-essential to `docs/suggestions.md`

### Priority 5. Release PR And Publish

Status: parked behind migration proof  
Plan: [V1 Closeout Plan](./plans/v1-closeout-plan.md)

Remaining:

1. prepare the v1 release PR
2. finalize versions and release notes
3. publish packages

## Active Product Tracks

### 5. AI-Native Monorepo And Template System

Status: completed baseline  
Reference: [AI-Native Template System Rollout](./archive/ai-native-template-system-rollout-2026-03-29.md)

Current truth:

1. local-first AI pack exists
2. hosted manifest and files exist
3. `create-airjam ai-pack status`, `diff`, and `update` exist
4. scaffold validation and freshness checks exist
5. Pong template structure, docs, skills, and tests were significantly upgraded

### 6. Unified Logging System

Status: completed baseline  
Reference: [Logging System Rollout](./archive/logging-system-rollout-2026-03-29.md)

Current truth:

1. unified dev sink is real
2. scaffolded projects have a log workflow
3. published CLI log command exists
4. generated-project sink behavior is validated
5. workspace toolchain logs now also land in the unified stream

## Active Framework Tracks

### 7. Auth Capability Hardening

Status: active  
Plan: [Auth Capability Plan](./plans/auth-capability-plan.md)

Remaining:

1. decide whether any stronger abuse posture is prerelease-critical
2. otherwise move remaining policy-tier ideas to `docs/suggestions.md` post-release

### 8. SDK Composability

Status: parked  
Plan: [SDK Composability Plan](./plans/sdk-composability-plan.md)

Current view:

1. good architecture direction
2. not on the immediate prerelease critical path unless it unblocks release UX

### 9. RPC Action Contract Refactor

Status: parked  
Plan: [SDK RPC Action Contract Plan](./plans/sdk-rpc-action-contract-plan.md)

Current view:

1. still a good safety architecture track
2. should only move forward now if we decide it is required before v1

## Documentation Hygiene Tasks

Status: ongoing repo rule

Remaining:

1. use this ledger consistently as the single active execution surface
2. archive completed plans more aggressively
3. keep architecture docs current as product direction evolves

## Recently Completed Baselines

These are done enough that they should not drive the day-to-day work queue:

1. Arcade architecture reset: [Arcade Architecture Reset Summary](./archive/arcade-architecture-reset-summary.md)
2. AI-pack hosted deployment hardening
3. controller-shell haptics baseline
4. workspace-to-unified-log ingestion
5. framework paradigm refresh across runtime, platform, AI-native workflow, analytics, and monetization direction
6. browser-level Arcade happy-path smoke inside the canonical release gate
7. legacy game migration guide plus tarball validation across the three ZeroDays reference games

## Rules

1. If a repo-level track matters now, it must appear here.
2. If a plan is active, it must be linked here.
3. If a plan is completed, archive it or mark it non-active here immediately.
4. Keep this file ordered by real execution priority, not by category alone.
5. Keep `docs/suggestions.md` limited to durable non-critical follow-ups.
