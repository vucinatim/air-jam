# Air Jam V1 Release Launch Plan

Last updated: 2026-04-09  
Status: active

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [Public Arcade Release Strategy](../strategy/public-arcade-release-strategy.md)
4. [Release Workflow](../strategy/release-workflow.md)
5. [Production Observability Baseline](../strategy/production-observability-baseline.md)
6. [Docs Index](../docs-index.md)
7. [Prerelease Systems Closeout Plan](./prerelease-systems-closeout-plan.md)
8. [Controller Preview Dock Plan](./controller-preview-dock-plan.md)
9. [Final Prerelease Manual Check Plan](./final-prerelease-manual-check-plan.md)
10. [Controller Reconnect And Resume Plan](../archive/controller-reconnect-resume-plan-2026-04-07.md)
11. [Postgres Dev And Analytics Test DB Plan](../archive/postgres-dev-and-analytics-test-db-plan-2026-04-04.md)
12. [Controller Capability And Perf Hardening Plan](../archive/controller-capability-and-perf-hardening-plan-2026-04-04.md)

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
7. run the last prerelease overpass and manual proof pass in [Final Prerelease Manual Check Plan](./final-prerelease-manual-check-plan.md)
8. finish final docs alignment and polish
9. upload the games through the hosted release lane
10. finish release media, blogs, and final landing-page overlook
11. merge into `master`, deploy, and test the live system
12. lock the release plan and execution sequence
13. post media and do manual launch marketing

Current mapping:

1. remaining implementation work currently means:
   1. the deferred visual-harness-driven cleanup/polish pass in [Prerelease Systems Closeout Plan](./prerelease-systems-closeout-plan.md)
   2. the on-screen preview-controller work in [Controller Preview Dock Plan](./controller-preview-dock-plan.md)
2. prerelease devex and SDK checks should happen after cleanup/polish, not before unfinished implementation
3. prerelease security checks should happen after the product shape is settled enough that findings do not churn with large feature edits
4. hosted upload, media/blogs, deployment, and launch distribution are late-stage release execution, not active prerelease implementation

## Execution Stages

### Stage 1. Finish Implementation

Complete every remaining product/framework feature that still belongs in v1 before switching the team into stabilization mode.

Current remaining implementation tracks:

1. [Controller Preview Dock Plan](./controller-preview-dock-plan.md)
2. any remaining planned prerelease cleanup that still changes shipped product behavior

### Stage 2. Fixes

Immediately after implementation is complete:

1. fix fallout from the last implementation pass
2. resolve regressions, obvious bugs, and behavior mismatches
3. avoid mixing this stage with new feature scope

### Stage 3. UI And Gameplay Polish

Do the visible host/controller polish pass here:

1. visual-harness-driven layout and responsiveness cleanup
2. last game-feel and shell-quality improvements
3. no new system design unless a polish blocker exposes a real architecture flaw

### Stage 4. Prerelease Cleanup

Use this stage to remove obvious prerelease rough edges:

1. dead/stale prerelease seams
2. outdated release-facing wording
3. leftover setup friction that should not survive into final checks

### Stage 5. Prerelease Devex And SDK Checks

Run the framework-facing confidence pass once the product shape is stable:

1. SDK package/build/type/test confidence
2. scaffold/devex sanity
3. release-lane and creator workflow sanity where it affects launch confidence

### Stage 6. Prerelease Security Checks

Run the final security-specific review after implementation and cleanup settle:

1. public release path review
2. dashboard/release/media surface review
3. auth and hosted-lane review

### Stage 7. Last Prerelease Overpass

This is the final manual proof and go/no-go pass:

1. execute [Final Prerelease Manual Check Plan](./final-prerelease-manual-check-plan.md)
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

1. [Prerelease Systems Closeout Plan](./prerelease-systems-closeout-plan.md)
2. [Controller Preview Dock Plan](./controller-preview-dock-plan.md)

All scattered manual verification has been moved into:

1. [Final Prerelease Manual Check Plan](./final-prerelease-manual-check-plan.md)

## Completed Baselines That No Longer Need Separate Active Plans

These are already done enough that they should not stay as parallel prerelease tracks:

1. release workflow and CI hardening
2. browser-level host/controller/join/launch smoke proof
3. migration proof on the three legacy ZeroDays games
4. SDK runtime ownership reset for host, controller, and audio
5. platform settings runtime, inherited iframe sync, and blocked-audio UX
6. GitHub-first dashboard auth baseline with email/password kept as intentional fallback
7. public Arcade hosted release lane, managed media lane, moderation/reporting hooks, and dashboard IA reset baseline

## Phase 1. Platform Feedback Path

Status: completed baseline

### Goal

Give dashboard users one obvious path to report product bugs during release.

### Required outcomes

1. add a bug-report entry point in the dashboard
2. route it to the official GitHub issues surface
3. keep the UI low-friction and obvious

### Done when

1. the dashboard exposes one clear bug-report action
2. release testers can report issues without hunting for the repo

## Phase 2. `air-capture` Reference Refactor

Status: completed baseline

### Goal

Make `air-capture` match the newer template-aligned architecture so it can serve as a real public reference app.

### Required outcomes

1. move `air-capture` to the same clean host/controller/game boundary style taught by the Pong template
2. add or tighten tests where the new structure makes them practical
3. validate the refactor locally and through Arcade

### Rule

Do this in one deliberate pass.
Do not keep nibbling at `air-capture` through isolated UI-only patches.

### Done when

1. `air-capture` matches the intended architecture well enough to teach from
2. it runs cleanly locally through Arcade
3. it no longer feels structurally behind the template direction

Current truth:

1. `air-capture` now has the modern host/controller/domain/store/engine/prefab/ui/debug/audio structure
2. the host/controller owner files were reduced into cleaner shell owners with extracted surface components
3. team-slot and arena prefab contracts now exist as explicit reusable seams
4. focused domain/prefab/store/engine tests now exist and pass
5. local Arcade manual validation confirmed host, controller, lobby, match, and return flows
6. the remaining scene-traversal and Rapier-lookup narrowing is now explicitly tracked as post-release cleanup, not prerelease launch work

## Phase 3. Legacy Showcase Game Alignment

Status: completed baseline

### Goal

Decide how far the three ZeroDays games need to move beyond the already-proven migration baseline.

### Required outcomes

1. decide whether each of the three games is a long-term public reference game
2. if yes, align it properly to the modern architecture and test posture
3. if no, keep the migration-proof baseline and do not over-refactor for purity

### Rule

Do not rewrite healthy legacy code just to imitate folder structure.
Only do deeper refactors when they improve long-term public maintainability.

### Done when

1. each legacy game has an explicit status:
   1. public maintained reference
   2. migration-proof only
2. any chosen reference game has clean enough structure and tests for public trust

Current truth:

1. `pong` and `air-capture` are the only canonical first-party reference games for v1
2. `code-review`, `last-band-standing`, and `the-office` should be treated as migration-proof showcase games, not template-aligned reference implementations
3. `code-review` is the lowest-risk legacy launch candidate and should stay in the launch set if the Arcade proof is clean
4. `last-band-standing` still uses the older direct audio-owner pattern and should only stay in the launch set if the Arcade proof is clean enough without further framework churn
5. `the-office` keeps a heavier custom host runtime and should only stay in the launch set if the Arcade proof is smooth enough without forcing it into template purity
6. the next decision gate for all three is the five-game local Arcade proof, not more prerelease architecture work

## Phase 4. Docs, Template, And Skills Alignment

Status: completed baseline

### Goal

Make the public docs, generated template docs pack, template README, and local skills teach the current SDK and platform truth instead of older prerelease slices.

### Required outcomes

1. audit `content/docs` for stale guidance around runtime ownership, shared settings/audio, auth, hosted releases, managed media, and the networked action contract
2. regenerate `packages/create-airjam/template-assets/base/docs/generated` from the corrected source docs
3. update `games/pong/README.md` to match the current SDK/platform model
4. update any template-local skills or AGENTS guidance that still teach stale framework or release patterns
5. make the final creator-facing story explicit:
   1. how to build a game
   2. how to produce a release artifact
   3. how to upload it in the dashboard
   4. how managed media fits into the release flow

### Done when

1. source docs and scaffolded generated docs tell the same story
2. the template README no longer teaches the stale self-hosted-only media/release path as the primary public flow
3. local skills and template guidance no longer contradict the current runtime/platform model

Current truth:

1. source docs now reflect explicit runtime ownership, shared platform settings/audio, and the narrowed networked action contract
2. quick-start now teaches the hosted artifact lane with `pnpm exec create-airjam release bundle --dir .` instead of the older public self-hosted URL flow
3. the scaffolded generated docs pack has been regenerated from the corrected source docs
4. the Pong template README now teaches the hosted artifact + managed media workflow
5. the template-local docs workflow and game architecture skills now explicitly cover generated-surface alignment and visible runtime boundaries

## Phase 5. Release Artifact Bundle Command

Status: completed baseline

### Goal

Give developers one clean local command that produces the exact static artifact they upload to the dashboard hosted-release flow.

### Required outcomes

1. add a developer-facing `create-airjam` command for building a release artifact bundle
2. make the output location and naming deterministic and obvious
3. define and document the hosted release artifact contract separately from flexible self-hosted routing
4. make the hosted artifact contract explicit:
   1. host entry is `/`
   2. controller entry is `/controller`
   3. the bundle carries an explicit release manifest for hosted-mode validation
5. add the corresponding platform-side validation and hosted serving behavior needed for that fixed contract
6. document the expected artifact contents and static-hosting constraints
7. add a smoke or validation check for the artifact-bundling path

### Rule

Do not build a full dashboard publish CLI unless the auth/token and publish workflow truly need it for v1.
The important prerelease need is a clean bundle command, not a second release surface.
Keep self-hosted mode flexible; only the dashboard-uploaded hosted artifact lane should be strict about route shape.

### Done when

1. a developer can run one documented command and get the dashboard-upload zip artifact
2. the hosted artifact contract is explicit and enforceable without affecting self-hosted routing freedom
3. platform hosted serving can reliably resolve the fixed hosted host/controller paths
4. the command is simple enough to recommend in the template README and docs
5. the artifact shape is proven enough that it does not feel like an undocumented manual packaging step

Current truth:

1. `create-airjam release bundle` now builds a hosted release zip with `.airjam/release-manifest.json`
2. the hosted dashboard lane now enforces the fixed `/` host and `/controller` controller contract without changing self-hosted routing freedom
3. platform hosted serving now resolves `/controller` through explicit SPA fallback instead of relying on artifact-specific hacks
4. the scaffolded Pong template now teaches `pnpm exec create-airjam release bundle --dir .` as the creator-facing entrypoint
5. the quick-start docs and template README now teach the hosted artifact workflow instead of the older self-hosted-only public release path

## Phase 6. Final Manual Prerelease Check

### Goal

Run one final manual proof pass across the local Arcade, dashboard hosted-release, managed-media, and official-server paths before release execution continues.

### Canonical manual runbook

The authoritative manual runbook now lives in:

1. [Final Prerelease Manual Check Plan](./final-prerelease-manual-check-plan.md)

Do not keep separate manual checklists in parallel prerelease plans.

### Done when

1. the final manual prerelease plan is complete
2. launch-set cuts, if any, are explicit
3. release execution can continue from recorded product proof instead of implied confidence

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
   2. remaining release gate:
      1. rerun real Arcade playtests for `air-capture` and confirm these fixes actually improve the trust/readability bar in live play
7. rerun `air-capture` and `last-band-standing` local Arcade proof after the above fixes and record whether they remain in the launch set without qualification
8. if any SDK/platform work lands here, realign:
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

### Goal

Finish the last end-to-end product-proof work on the hosted release lane before public deploy work begins.

Detailed manual execution for this phase now lives in:

1. [Final Prerelease Manual Check Plan](./final-prerelease-manual-check-plan.md)

### Required outcomes

1. run one dashboard-level hosted release upload → checks → make-live → listed-in-Arcade smoke
2. run one dashboard-level managed media upload/assignment → public catalog render smoke
3. confirm these flows against the now-final dashboard IA and hosted release contract

### Done when

1. hosted releases are proven through the real dashboard flow, not only by lower-level implementation confidence
2. managed media is proven through the real dashboard and public catalog path

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

### Goal

Prove the public game set against the actual official backend path.

Detailed manual execution for this phase now lives in:

1. [Final Prerelease Manual Check Plan](./final-prerelease-manual-check-plan.md)

### Required outcomes

1. verify each public game against the official servers
2. validate room creation, controller join, gameplay start, and return flows
3. fix any production-only auth, env, or integration issues

### Done when

1. all five games are confirmed working against the official hosted runtime path

## Phase 12. Release Merge And Platform Deploy

### Goal

Turn the validated prerelease state into the public platform state.

### Required outcomes

1. merge the large release branch into `master`
2. deploy the new platform
3. confirm the deployed platform reflects the intended public release surface

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
