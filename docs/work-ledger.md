# Air Jam Work Ledger

Last updated: 2026-04-02  
Status: active

This is the single active repo-wide ledger.

Use it to answer:

1. what matters now
2. what is already done
3. which active plans still matter
4. which tracks should be archived or collapsed

## Current Execution Order

Air Jam should now move through prerelease work in one canonical plan:

1. decide the final launch posture of the three legacy showcase games
2. finish the five-game launch-set proof locally through Arcade
3. resolve the release-critical issues surfaced by real multiplayer playtests
4. prove the hosted release and managed media dashboard flows end to end
5. produce release media, connect official hosting, validate on official servers, and publish

Canonical prerelease plan: [V1 Release Launch Plan](./plans/v1-release-launch-plan.md)

Anything outside that order should only move in parallel when it does not slow the critical path.

## Release-Critical Path

### Priority 1. Release Workflow And CI Hardening

Status: completed baseline  
Reference: [Release Prep Plan (Archived)](./archive/release-prep-plan-2026-03-31.md)

Completed:

1. package publish targeting is explicit
2. CI now enforces the canonical release contract
3. release-visible platform browser console noise was removed from arcade/controller-facing runtime paths

### Priority 2. Browser-Level Product Proof

Status: completed baseline  
Reference: [Release Prep Plan (Archived)](./archive/release-prep-plan-2026-03-31.md)

Completed:

1. one true browser-level host/controller/join/launch smoke path now runs inside `pnpm check:release`
2. the smoke path uses a deterministic local Arcade reference game instead of database-seeded public content

### Priority 3. Migration Proof

Status: completed baseline  
Reference: [V1 Closeout Plan (Archived)](./archive/v1-closeout-plan-2026-03-31.md)

Completed:

1. the concrete migration guide now exists in [Legacy Game Migration Guide](./systems/legacy-game-migration-guide.md)
2. the three legacy ZeroDays games are already on the current bootstrap and route model
3. repo-owned local tarball validation now proves `code-review`, `last-band-standing`, and `the-office` against packaged SDK/server dependencies via `pnpm test:legacy:tarball`

### Priority 4. Canonical Prerelease Execution

Status: active  
Plan: [V1 Release Launch Plan](./plans/v1-release-launch-plan.md)

Remaining:

1. finish the local Arcade proof for the three remaining showcase games: `code-review`, `last-band-standing`, and `the-office`
2. land the release-critical playtest hardening stack:
   1. prove the controller reconnect/resume baseline in real launch-set gameplay
   2. `air-capture` high-priority gameplay fixes
3. rerun the baseline pair after those fixes and confirm they remain launch-trustworthy
4. run the final hosted release and managed media dashboard proof paths
5. create release media assets
6. connect and deploy all public games on official hosting
7. validate all five games against the official servers
8. merge the release PR, deploy the platform, and publish the launch content

Active subsystem plan linked from this phase:

1. [Controller Reconnect And Resume Plan](./plans/controller-reconnect-resume-plan.md)

Completed baselines now folded into this phase:

1. GitHub-first dashboard auth is already live, with email/password intentionally retained as fallback for the initial release
2. `air-capture` now has a modern host/controller/domain/store/engine/prefab/ui/debug/audio structure
3. SDK runtime ownership is now explicit for host, controller, and audio
4. shared platform settings now propagate cleanly from Arcade/controller surfaces into embedded games
5. public Arcade hosted releases, managed media, and dashboard IA are already implemented at the product-foundation level
6. the strict hosted-artifact route contract and developer-facing release bundle command now exist as real prerelease baselines
7. source docs, generated scaffold docs, template README, and template-local skills are now aligned with the current SDK/runtime/release model
8. `air-capture` has now passed its final prerelease reference-quality audit; the remaining runtime seam narrowing is post-release cleanup, not launch-critical work
9. the three legacy ZeroDays games now have an explicit prerelease posture: migration-proof showcase games only, with `pong` and `air-capture` remaining the only canonical first-party reference implementations
10. the baseline pair now has real local Arcade proof coverage:
   1. `pong` host/controller happy path passes through the local Arcade browser smoke
   2. `air-capture` settings/audio Arcade smoke passes through the local Arcade browser smoke
11. a longer real playtest of `air-capture` and `last-band-standing` surfaced the next honest prerelease gate:
   1. reconnect/resume now has a real SDK/server baseline:
      1. stable controller device identity
      2. room-scoped resumable controller lease
      3. same-device automatic resume
      4. conflicting-device rejection
   2. Pong now has local Arcade browser proof for reconnect/resume after controller refresh; the remaining reconnect gate is live gameplay proof in `air-capture` and `last-band-standing`
   3. controller fullscreen prompting is now explicit and productized at the controller shell boundary, with dedicated browser smoke coverage
   4. `air-capture`'s first gameplay hardening pass is now in:
      1. analog left-stick movement with right-side actions only
      2. own-flag-carried enemy pickup lockout
      3. stronger large-radius rocket blast tuning
      4. lobby name visibility on host and controller
      5. 3-second rotation-only opening countdown
   5. the remaining gate for that slice is another real Arcade playtest, not more blind refactoring
   6. Arcade waiting-state now has a first-pass platform-owned `ping` interaction:
      1. controller waiting shell exposes a `Ping host` action
      2. Arcade host plays a dedicated `piing` SFX with a small visual acknowledgment
      3. the action is host-cooled-down so one controller cannot spam the shell
   7. couch-readability and menu-affordance polish still need explicit prioritization after the next proof pass
12. release moderation and enforcement are now split cleanly by audience:
   1. upload finalization now runs automated screenshot + image moderation before a release settles into `ready`
   2. creator release pages keep upload/publish/archive plus release history, but no longer expose moderation or quarantine controls
   3. internal moderation and quarantine actions now live behind a database-backed `ops_admin` role on `/dashboard/ops/releases`
13. the monorepo root now reflects the real product boundary more honestly:
   1. platform-owned product surfaces remain under `apps/`
   2. repo-owned first-party games can now live under `games/`
   3. `air-capture` has been moved from `apps/air-capture` to `games/air-capture` as the first clean example of that split

### Priority 5. Release PR And Publish

Status: active  
Plan: [V1 Release Launch Plan](./plans/v1-release-launch-plan.md)

Remaining:

1. merge the release PR and deploy the platform once the canonical prerelease execution phase is complete
2. publish the release and ZeroDays articles
3. execute the first GTM and community rollout

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

### 7. Game-Source Scaffolding

Status: completed baseline  
Reference: [Game Source Scaffolding Plan](./plans/game-source-scaffolding-plan.md)

Current truth:

1. `games/` is now the honest home for repo-owned games
2. `games/pong` and `games/air-capture` now declare scaffold manifests and serve as the first real source-of-truth scaffoldable games
3. `create-airjam` now snapshots scaffold sources from `games/`, supports `--template=<id>`, and offers interactive template selection when no template is provided
4. the duplicated Pong template source tree has been retired in favor of `games/pong`
5. `pnpm test:scaffold` now proves every scaffoldable game through the shared export path, install, typecheck, test, and build flow

## Active Framework Tracks

Status: none beyond the canonical release plan

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
8. prerelease production observability baseline is now explicit across Better Stack uptime, Vercel Web Analytics, Vercel Speed Insights, and Air Jam's own runtime analytics
9. the platform dashboard now exposes a direct bug-report path to the official GitHub issues surface
10. `air-capture` now teaches the modern reference architecture and has passed manual Arcade validation after the current refactor phases
11. GitHub-first dashboard auth is implemented and production-configured for the initial release posture
12. SDK runtime ownership is explicit and shared platform settings are now deterministic and productized across Arcade, controller surfaces, and embedded games
13. the public Arcade hosted release lane, managed media lane, and dashboard IA reset are implemented at the baseline product level
14. auth capability hardening is complete enough for prerelease and no longer needs active plan tracking
15. the old SDK composability direction has been superseded by the explicit runtime-ownership model and no longer needs active plan tracking
16. controller-to-host RPC actions now enforce the narrow network contract: zero args or one plain-object payload, with runtime diagnostics and protocol validation backing the type surface
17. the dashboard-hosted artifact lane now has an explicit `.airjam/release-manifest.json` contract, fixed `/` + `/controller` route behavior, and a creator-facing `release:bundle` workflow through `create-airjam`
18. the source docs, generated docs pack, Pong template README, and template-local skills now tell the same current prerelease story

## Rules

1. If a repo-level track matters now, it must appear here.
2. If a plan is active, it must be linked here.
3. If a plan is completed, archive it or mark it non-active here immediately.
4. Keep this file ordered by real execution priority, not by category alone.
5. Keep `docs/suggestions.md` limited to durable non-critical follow-ups.
