# Air Jam V1 Release Launch Plan

Last updated: 2026-04-15  
Status: active

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [Public Arcade Release Strategy](../strategy/public-arcade-release-strategy.md)
4. [Release Workflow](../strategy/release-workflow.md)
5. [Production Observability Baseline](../strategy/production-observability-baseline.md)
6. [Docs Index](../docs-index.md)
7. [Prerelease Systems Closeout Plan (Archived)](../archive/prerelease-systems-closeout-plan-2026-04-09.md)
8. [Controller Preview Dock Plan (Archived)](../archive/controller-preview-dock-plan-2026-04-09.md)
9. [Agent Runtime Contract Plan (Archived)](../archive/agent-runtime-contract-plan-2026-04-09.md)
10. [Stage 3 Polish Plan (Archived)](../archive/stage-3-polish-plan-2026-04-15.md)
11. [Final Prerelease Hardening And Cleanup Plan](./final-prerelease-hardening-and-cleanup-plan.md)
12. [Final Release Checks Plan](./final-release-checks-plan.md)
13. [Controller Reconnect And Resume Plan](../archive/controller-reconnect-resume-plan-2026-04-07.md)
14. [Postgres Dev And Analytics Test DB Plan](../archive/postgres-dev-and-analytics-test-db-plan-2026-04-04.md)
15. [Controller Capability And Perf Hardening Plan](../archive/controller-capability-and-perf-hardening-plan-2026-04-04.md)

## Purpose

This plan captures the concrete path from the current prerelease state to a public Air Jam launch with:

1. polished showcase games
2. working official hosted deploys
3. release media and content
4. a simple go-to-market sequence

It exists so launch execution stays ordered and does not fragment across chat notes, polish plans, and content drafts.

This is now the single canonical prerelease execution plan.
If a remaining item materially affects the v1 release, it should be tracked here instead of staying in a parallel active prerelease plan.

## Core Position

Air Jam should launch from real proof, not just from docs and packages.

That means:

1. the official showcase games must work locally and on the official hosted platform
2. the public assets must make the games legible
3. the launch content must support a technically real product

## Launch Set

The intended public release set is:

1. `pong`
2. `air-capture`
3. `code-review`
4. `last-band-standing`
5. `the-office`

## Non-Goals

This plan is not for:

1. reopening framework architecture
2. replacing the current auth direction
3. inventing a larger observability stack
4. broad landing-page redesign

## Decisions Already Made

1. keep the email/password fallback available for the initial release
2. keep GitHub auth as the primary platform sign-in path
3. treat `air-capture` as the final major reference-app refactor, not an endless polish stream
4. use the five-game launch set above as the real product proof bar
5. runtime ownership and shared platform settings are now considered settled prerelease baselines, not active framework tracks
6. the hosted release lane, managed media lane, and dashboard IA reset are now considered implemented baselines; the remaining v1 work is end-to-end proof, not more product architecture

## Execution Order

Air Jam should move through launch execution in this order:

1. finish all remaining prerelease implementation work up front
2. run the immediate post-implementation fix pass
3. do UI and gameplay polish
4. do prerelease cleanup
5. run prerelease devex and SDK checks
6. run prerelease security checks
7. run the last prerelease overpass and manual proof pass in [Final Release Checks Plan](./final-release-checks-plan.md)
8. finish final docs alignment and polish
9. upload the games through the hosted release lane
10. finish release media, blogs, and final landing-page overlook
11. merge into `master`, deploy, and test the live system
12. lock the release plan and execution sequence
13. post media and do manual launch marketing

Current mapping:

1. remaining implementation work currently means:
   1. no broad feature implementation plan remains active
   2. the only active late implementation/improvement track is [Final Prerelease Hardening And Cleanup Plan](./final-prerelease-hardening-and-cleanup-plan.md)
   3. deferred visual-harness-driven cleanup stays in Stage 3 polish or later cleanup, not Stage 1 implementation
2. prerelease devex and SDK checks should happen after cleanup/polish, not before unfinished implementation
3. prerelease security checks should happen after the product shape is settled enough that findings do not churn with large feature edits
4. hosted upload, media/blogs, deployment, and launch distribution are late-stage release execution, not active prerelease implementation

## Execution Stages

### Stage 1. Finish Implementation

Complete every remaining product/framework feature that still belongs in v1 before switching the team into stabilization mode.

Current remaining implementation tracks:

1. none at the broad feature level
2. the only active late pass is the bounded [Final Prerelease Hardening And Cleanup Plan](./final-prerelease-hardening-and-cleanup-plan.md)

### Stage 2. Fixes

Immediately after implementation is complete:

1. fix fallout from the last implementation pass
2. resolve regressions, obvious bugs, and behavior mismatches
3. avoid mixing this stage with new feature scope

Immediate known fix target:

1. continue resolving post-implementation fallout without reopening feature scope
2. keep validating Arcade-built host/controller flows after the explicit `controllerUrl` contract replaced platform-side inference
3. the full launch-set Arcade-built lobby sweep is now green at the shared host/controller baseline
4. the full canonical `pnpm run check:release` gate is now green again after the shared server/SDK/platform fix pass
5. unless a new regression appears, Stage 2 can now be treated as closed enough to move the main execution focus into late Stage 3 polish, final manual proof, and release execution

### Stage 3. UI And Gameplay Polish

The Stage 3 launch-set polish pass is complete. Details are archived in [Stage 3 Polish Plan (Archived)](../archive/stage-3-polish-plan-2026-04-15.md).

Any surviving polish-shaped item now surfaces as a finding inside [Final Release Checks Plan](./final-release-checks-plan.md) and loops back into [Final Prerelease Hardening And Cleanup Plan](./final-prerelease-hardening-and-cleanup-plan.md) only if it turns out to matter for launch.

### Stage 4. Prerelease Cleanup

Use this stage to remove obvious prerelease rough edges:

1. dead/stale prerelease seams
2. outdated release-facing wording
3. leftover setup friction that should not survive into final checks

Current active cleanup/hardening plan:

1. [Final Prerelease Hardening And Cleanup Plan](./final-prerelease-hardening-and-cleanup-plan.md)

### Stage 5. Prerelease Devex And SDK Checks

Run the framework-facing confidence pass once the product shape is stable:

1. SDK package/build/type/test confidence
2. scaffold/devex sanity
3. release-lane and creator workflow sanity where it affects launch confidence

Current truth:

1. the canonical prerelease gate is green again through `pnpm run check:release`
2. browser smoke, perf sanity, and scaffold smoke are included in that green state
3. the next work is no longer framework/devex confidence repair; it is final manual proof plus late release execution

### Stage 6. Prerelease Security Checks

Run the final security-specific review after implementation and cleanup settle:

1. public release path review
2. dashboard/release/media surface review
3. auth and hosted-lane review

### Stage 7. Last Prerelease Overpass

This is the final manual proof and go/no-go pass:

1. execute [Final Release Checks Plan](./final-release-checks-plan.md)
2. record findings and required blockers
3. only exit this stage when the launch set has a clear go/no-go status

### Stage 8. Final Docs Alignment And Polish

After the product and prerelease checks are stable:

1. align docs with the final shipped truth
2. polish release-facing guidance
3. avoid reopening implementation unless docs reveal a real blocker

### Stage 9. Hosted Uploads

1. upload the final games
2. verify the hosted release surfaces are correct
3. keep this distinct from final manual overpass work

### Stage 10. Media, Blogs, And Landing Overlook

1. finalize release media
2. finalize blog/article content
3. do the last landing-page/readability sweep

### Stage 11. Merge, Deploy, And Live Test

1. merge into `master`
2. deploy the platform and release surfaces
3. run live validation on the real deployment

### Stage 12. Release Planning And Distribution

1. lock the release plan timing/order
2. post media
3. do manual launch marketing

## Active Parallel Prerelease Implementation Plans

Only these implementation plans should stay active alongside this launch plan:

1. [Final Prerelease Hardening And Cleanup Plan](./final-prerelease-hardening-and-cleanup-plan.md)

All scattered manual verification has been moved into:

1. [Final Release Checks Plan](./final-release-checks-plan.md)

## Completed Baselines That No Longer Need Separate Active Plans

These are already done enough that they should not stay as parallel prerelease tracks:

1. release workflow and CI hardening
2. browser-level host/controller/join/launch smoke proof
3. migration proof on the three legacy ZeroDays games
4. SDK runtime ownership reset for host, controller, and audio
5. platform settings runtime, inherited iframe sync, and blocked-audio UX
6. GitHub-first dashboard auth baseline with email/password kept as intentional fallback
7. public Arcade hosted release lane, managed media lane, moderation/reporting hooks, and dashboard IA reset baseline
8. shared preview controllers across platform, repo-host, and scaffold-host flows
9. prerelease agent-runtime namespace and seam alignment across runtime-control, runtime-inspection, runtime-observability, and capabilities
10. systems closeout is complete enough to archive: SDK/runtime cleanup is done, built-mode visual capture reuses unchanged game builds, and deferred harness cleanup now belongs to the later polish stage

## Completed Baselines (Phases 1–5)

Phases 1–5 are all complete. Full writeups with goals, rules, and current truth previously lived inline; the summaries below are the durable record.

### Phase 1. Platform Feedback Path

The dashboard exposes one clear bug-report action that routes to the official GitHub issues surface.

### Phase 2. `air-capture` Reference Refactor

`air-capture` now has the modern host/controller/domain/store/engine/prefab/ui/debug/audio structure with focused tests. Host/controller owners were reduced to shell owners with extracted surface components, team-slot and arena prefab contracts are explicit seams, and local Arcade manual validation confirmed host, controller, lobby, match, and return flows. Remaining scene-traversal and Rapier-lookup narrowing is explicitly post-release cleanup.

### Phase 3. Legacy Showcase Game Alignment

`pong` and `air-capture` are the canonical first-party reference games for v1. `code-review`, `last-band-standing`, and `the-office` are migration-proof showcase games, not template-aligned reference implementations. Next decision gate for all three is the five-game local Arcade proof inside [Final Release Checks Plan](./final-release-checks-plan.md), not more prerelease architecture work.

### Phase 4. Docs, Template, And Skills Alignment

Source docs reflect the current SDK and platform truth: explicit runtime ownership, shared platform settings/audio, narrowed networked action contract, hosted artifact + managed media workflow. The scaffolded generated docs pack was regenerated from the corrected source docs, the Pong template README teaches the current workflow, and template-local docs/skills cover generated-surface alignment and visible runtime boundaries.

### Phase 5. Release Artifact Bundle Command

`pnpm exec create-airjam release bundle --dir .` builds a hosted release zip with `.airjam/release-manifest.json`. The hosted dashboard lane enforces the fixed `/` host and `/controller` controller contract without affecting self-hosted routing freedom. Platform hosted serving resolves `/controller` through explicit SPA fallback. Quick-start docs and the Pong template README teach the hosted artifact workflow instead of the older self-hosted-only path.

## Phase 6. Final Release Checks

All prerelease and release checks live in [Final Release Checks Plan](./final-release-checks-plan.md). That plan is the single runbook for local launch-set proof, dashboard hosted-release + managed-media proof, official-server proof, playtest reruns, the SDK export audit, the canonical release gate rerun, live deploy validation, and the final go / no-go record.

This launch plan no longer duplicates that content.

### Done when

1. the final release checks plan records an explicit go / no-go decision
2. launch-set cuts, if any, are recorded in that plan

## Phase 7. Playtest-Driven Launch Hardening

### Goal

Turn the issues found in real multi-player couch-style playtests into one explicit prerelease decision stack instead of letting them drift across chat.

### Release-critical before v1

These should be handled before public launch because they affect trust, recoverability, or the core play loop:

1. done baseline: the controller reconnect/resume contract is now product-proven so a dropped player can rejoin safely during live gameplay without corrupting host state
   1. implemented baseline:
      1. stable controller device identity
      2. room-scoped resumable player-slot lease
      3. same-device automatic resume attempt
      4. conflicting-device resume rejection
   2. validation now proven in real local Arcade flow for:
      1. `pong`
      2. `air-capture`
      3. `last-band-standing`
   3. broader "continuous player device save system" can remain a later expansion if the smaller resume baseline solves the trust problem cleanly
   4. implementation details live in [Controller Reconnect And Resume Plan](../archive/controller-reconnect-resume-plan-2026-04-07.md)
2. done baseline: isolate destructive runtime analytics tests onto a dedicated Postgres path and add a repo-owned local development Postgres workflow
   1. local development should have one persistent repo-owned Postgres with visible local state under `.airjam/`
   2. destructive analytics tests must use an isolated database path and never fall back to the normal runtime `DATABASE_URL`
   3. implementation details live in [Postgres Dev And Analytics Test DB Plan](../archive/postgres-dev-and-analytics-test-db-plan-2026-04-04.md)
3. gate privileged controller channels behind an explicit controller capability instead of only room membership
   1. this applies only to elevated controller channels such as `controller:system`, `controller:play_sound`, and `controller:action_rpc`
   2. normal controller gameplay/input should remain available to ordinary room joins
   3. implementation details live in [Controller Capability And Perf Hardening Plan](../archive/controller-capability-and-perf-hardening-plan-2026-04-04.md)
4. turn the existing server perf sanity harness into a real release-confidence gate
   1. keep the current baseline path
   2. add reconnect-churn coverage
   3. enforce committed thresholds through strict mode in the release-confidence path
   4. implementation details live in [Controller Capability And Perf Hardening Plan](../archive/controller-capability-and-perf-hardening-plan-2026-04-04.md)
5. add a consistent controller-open fullscreen prompt for Arcade and game controller surfaces
   1. this should be a user-gesture-driven prompt, not a silent forced fullscreen call
   2. current truth:
      1. the prompt now appears on room-backed controller open
      2. controller-local browser smoke covers the prompt explicitly
      3. existing Pong and `air-capture` controller smokes now dismiss it as part of the product contract
6. improve `air-capture`'s high-priority gameplay clarity and correctness:
   1. current truth:
      1. controller playing UI now uses a real left-side analog movement stick and keeps the right side focused on `Ability` + `Shoot`
      2. a team can no longer pick up the enemy flag while its own flag is already being carried
      3. rocket blast was tuned into a larger distance-scaled AOE so it reads clearly in live play
      4. player names are now visible in the lobby on both host and controller surfaces
      5. match start now goes through a 3-second countdown phase where pilots can rotate but cannot thrust or fire
   2. remaining playtest reruns live in [Final Release Checks Plan](./final-release-checks-plan.md) Workstream D
7. if any SDK/platform work lands here, realign:
   1. `pong`
   2. `air-capture`
   3. `code-review`
   4. `last-band-standing`
   5. `the-office`
   6. source docs
   7. generated template docs
   8. template skills / AI pack guidance

### Important prerelease polish if time allows

These are meaningful launch-quality improvements, but they should not displace the release-critical items above:

1. add clearer TV/couch readability guidance for game UIs
   1. prefer docs, skills, and a small reusable pattern over a heavy framework-level auto-scaling abstraction
   2. if a tiny helper emerges naturally, keep it minimal and optional
2. improve the Arcade waiting-state experience
   1. done baseline: a small social interaction called `ping` now exists in the controller waiting shell
   2. done baseline: `ping` triggers a satisfying host-side `piing` sound effect plus a small Arcade chrome acknowledgment
   3. keep the first pass intentionally small; do not open a side quest for a full waiting mini-game unless the shipped interaction feels insufficient
3. make the Arcade menu affordance more obvious
   1. e.g. animate the ship/logo notch so it reads as an interactive upward arrow
4. improve `air-capture` clarity polish:
   1. add subtle in-game floating player names
   2. revisit any remaining readability issues surfaced during the next playtest

### Explicitly post-release

These ideas are worth keeping, but they should not muddy the v1 path:

1. a broader continuous player-device save / long-lived resume system beyond the smaller reconnect baseline above
2. a richer waiting-state background activity or mini-game for Arcade
3. a generalized framework-level UI scaling system if docs + patterns prove insufficient after launch
4. deeper `air-capture` flight-feel tuning such as additional air maneuverability once correctness and readability are settled

### Done when

1. the release-critical playtest issues have explicit fixes or explicit deferrals
2. the baseline pair (`pong`, `air-capture`) still feel trustworthy after the fixes
3. the launch path is not carrying vague playtest TODOs outside this plan

## Phase 8. Dashboard Hosted Release And Managed Media Proof

Dashboard hosted-release and managed-media proof lives in [Final Release Checks Plan](./final-release-checks-plan.md) Workstream B.

This launch plan no longer duplicates that content.

## Phase 9. Release Media Assets

### Goal

Make the platform showcase legible and visually credible.

### Required outcomes

1. record preview videos for each public game
2. generate or create thumbnail and cover images for each
3. place the final assets into the platform publishing surfaces

### Rule

The media should clarify the game, not oversell it.

### Done when

1. every public game has a thumbnail
2. every public game has a cover image
3. every public game has a preview video where appropriate

## Phase 10. Official Hosting And Platform Connection

### Goal

Get the public game set connected to the real hosted platform.

### Required outcomes

1. `pong` and the three ZeroDays games have official deploy targets
2. required env vars are set
3. app IDs are issued and connected through the dashboard
4. `air-capture` continues to deploy cleanly through its existing Vercel path

### Done when

1. all five games are deployed on official hosting
2. all five games are connected to the official platform configuration

## Phase 11. Official Server Validation

Official hosting and official-server proof lives in [Final Release Checks Plan](./final-release-checks-plan.md) Workstream C.

This launch plan no longer duplicates that content.

## Phase 12. Release Merge And Platform Deploy

### Goal

Turn the validated prerelease state into the public platform state.

### Required outcomes

1. merge the large release branch into `master`
2. deploy the new platform

Post-deploy live validation lives in [Final Release Checks Plan](./final-release-checks-plan.md) Workstream G.

## Phase 13. Release Content

### Goal

Support the launch with clear public writing.

### Required outcomes

1. publish the main Air Jam release article
2. update and publish the ZeroDays article with current images and videos

### Rule

Content should follow validated product proof, not race ahead of it.

## Phase 14. GTM And Community Setup

### Goal

Give the release a real chance to be discovered and shared.

### Required outcomes

1. create the GTM checklist for:
   1. friends and close supporters
   2. forums and communities
   3. Discords when relevant as outbound posting targets, not as the primary owned community surface
   4. Reddit
   5. Hacker News
   6. LinkedIn through ZeroDays
2. use GitHub Discussions as the primary public community surface for the initial release
3. defer public Discord linking until it is genuinely ready to moderate

### Done when

1. launch-day posting targets are prepared
2. the support/community surface is explicit instead of improvised

## Closeout Rule

This plan is complete when:

1. the five-game launch set is live and validated
2. the release content is published
3. the initial GTM sequence has been executed

Anything left after that should move to [Suggestions](../suggestions.md) or a post-release plan.
