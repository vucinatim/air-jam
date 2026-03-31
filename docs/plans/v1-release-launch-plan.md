# Air Jam V1 Release Launch Plan

Last updated: 2026-03-31  
Status: active

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [Public Arcade Release Strategy](../strategy/public-arcade-release-strategy.md)
4. [Release Workflow](../strategy/release-workflow.md)
5. [Production Observability Baseline](../strategy/production-observability-baseline.md)
6. [Docs Index](../docs-index.md)

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

1. add the platform dashboard bug-report path
2. close the last `air-capture` reference-quality engine-boundary work
3. decide which legacy games need full template-aligned structure upgrades
4. get all five games running locally through Arcade
5. run the final dashboard-level hosted release and managed media proof paths
6. create release media assets
7. connect and deploy all public games on official hosting
8. validate all public games against the official servers
9. merge the release PR and deploy the platform
10. publish release content
11. execute the launch distribution plan

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

Status: active

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
6. one more engine-boundary pass is still warranted before this phase should be called complete

## Phase 3. Legacy Showcase Game Alignment

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

## Phase 4. Local Arcade Proof Across All Five Games

### Goal

Prove the real launch set locally before touching production hosting.

### Required outcomes

1. all five games boot and run through the local Arcade path
2. host/controller flows work for each
3. obvious runtime or integration failures are resolved before deploy work begins

### Done when

1. all five games are locally published in Arcade
2. all five games run cleanly enough to record and present publicly

## Phase 5. Dashboard Hosted Release And Managed Media Proof

### Goal

Finish the last end-to-end product-proof work on the hosted release lane before public deploy work begins.

### Required outcomes

1. run one dashboard-level hosted release upload → checks → make-live → listed-in-Arcade smoke
2. run one dashboard-level managed media upload/assignment → public catalog render smoke
3. confirm these flows against the now-final dashboard IA and hosted release contract

### Done when

1. hosted releases are proven through the real dashboard flow, not only by lower-level implementation confidence
2. managed media is proven through the real dashboard and public catalog path

## Phase 6. Release Media Assets

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

## Phase 7. Official Hosting And Platform Connection

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

## Phase 8. Official Server Validation

### Goal

Prove the public game set against the actual official backend path.

### Required outcomes

1. verify each public game against the official servers
2. validate room creation, controller join, gameplay start, and return flows
3. fix any production-only auth, env, or integration issues

### Done when

1. all five games are confirmed working against the official hosted runtime path

## Phase 9. Release Merge And Platform Deploy

### Goal

Turn the validated prerelease state into the public platform state.

### Required outcomes

1. merge the large release branch into `master`
2. deploy the new platform
3. confirm the deployed platform reflects the intended public release surface

## Phase 10. Release Content

### Goal

Support the launch with clear public writing.

### Required outcomes

1. publish the main Air Jam release article
2. update and publish the ZeroDays article with current images and videos

### Rule

Content should follow validated product proof, not race ahead of it.

## Phase 11. GTM And Community Setup

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
