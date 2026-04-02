# Air Jam V1 Release Launch Plan

Last updated: 2026-04-01  
Status: active

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [Public Arcade Release Strategy](../strategy/public-arcade-release-strategy.md)
4. [Release Workflow](../strategy/release-workflow.md)
5. [Production Observability Baseline](../strategy/production-observability-baseline.md)
6. [Docs Index](../docs-index.md)
7. [Controller Reconnect And Resume Plan](./controller-reconnect-resume-plan.md)

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
2. decide which legacy games need full template-aligned structure upgrades
3. get all five games running locally through Arcade
4. resolve the critical issues surfaced by real multiplayer playtests
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
3. update `packages/create-airjam/templates/pong/README.md` to match the current SDK/platform model
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
2. quick-start now teaches the hosted artifact lane with `pnpm release:bundle` instead of the older public self-hosted URL flow
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
4. the scaffolded Pong template now exposes `pnpm release:bundle` as the recommended creator-facing entrypoint
5. the quick-start docs and template README now teach the hosted artifact workflow instead of the older self-hosted-only public release path

## Phase 6. Local Arcade Proof Across All Five Games

### Goal

Prove the real launch set locally before touching production hosting.

### Required outcomes

1. all five games boot and run through the local Arcade path
2. host/controller flows work for each
3. obvious runtime or integration failures are resolved before deploy work begins

### Execution order

Run the proof in this exact order:

1. `pong`
2. `air-capture`
3. `code-review`
4. `last-band-standing`
5. `the-office`

Reason:

1. start with the two canonical first-party reference games to prove the current framework/platform baseline first
2. then move through the three migration-proof showcase games in ascending risk order

### Local source of truth

Use these project roots for the proof:

1. repo-local template/reference games:
   1. `packages/create-airjam/templates/pong`
   2. `apps/air-capture`
2. external ZeroDays showcase games:
   1. `/Users/timvucina/Desktop/zerodays/air-jam-games/code-review`
   2. `/Users/timvucina/Desktop/zerodays/air-jam-games/last-band-standing`
   3. `/Users/timvucina/Desktop/zerodays/air-jam-games/the-office`

Each legacy game already exposes the same local entrypoint shape:

1. `pnpm dev`
2. `pnpm typecheck`
3. `pnpm build`

### Per-game proof checklist

Each game should be judged with the same checklist:

1. host route opens from local Arcade without manual patching
2. controller join works from QR/join flow
3. controller reaches the intended controller UI cleanly
4. game can start from its normal lobby or ready flow
5. core gameplay loop works for at least one short session
6. host return/lobby/reset path works if the game exposes one
7. no obvious launch-blocking runtime error appears in the browser/log sink
8. shared platform settings do not break the game surface
9. the game feels publicly presentable enough for v1

### Evidence to record

Record one outcome per game:

1. `pass`
2. `pass with note`
3. `blocker`

For each `pass with note` or `blocker`, capture:

1. short issue summary
2. whether it is a prerelease fix or launch-set cut decision
3. whether it affects only polish or actual product trust

### Decision policy

Use these rules during the proof:

1. `pong` and `air-capture` are canonical first-party references and should be fixed unless the issue is clearly outside the v1 scope
2. `code-review`, `last-band-standing`, and `the-office` are migration-proof showcase games only; do not refactor them toward template purity during this phase
3. if a legacy game has only polish notes, keep it
4. if a legacy game has a small, isolated prerelease fix, do that fix
5. if a legacy game has structural or trust-damaging issues, cut it from the v1 launch set instead of opening a new architecture stream

### Logging and validation aids

Use the repo log sink and existing local workflows during the proof:

1. repo workspace dev path:
   1. `pnpm dev` for `air-capture`
   2. `pnpm dev -- --pong` for Pong
2. per-game legacy proof path from each external project root:
   1. `pnpm dev`
3. canonical local logs:
   1. `.airjam/logs/dev-latest.ndjson`
   2. `pnpm dev:logs`

### Done when

1. all five games are locally published in Arcade
2. each game has a recorded outcome: `pass`, `pass with note`, or `blocker`
3. any launch-set cuts are made explicitly instead of staying implied
4. the launch set is small enough and clean enough to move into hosted-release proof with confidence

Current proof progress:

1. `pong`: `pass`
   1. host/controller happy path now passes through local Arcade browser smoke
   2. root cause fixed: embedded host bridge was being torn down on normal dependency churn in the Arcade host shell
2. `air-capture`: `pass`
   1. local Arcade settings/audio smoke now passes
3. remaining to prove:
   1. `code-review`
   2. `last-band-standing`
   3. `the-office`

## Phase 7. Playtest-Driven Launch Hardening

### Goal

Turn the issues found in real multi-player couch-style playtests into one explicit prerelease decision stack instead of letting them drift across chat.

### Release-critical before v1

These should be handled before public launch because they affect trust, recoverability, or the core play loop:

1. finish product-proof of the controller reconnect/resume baseline so a dropped player can rejoin safely during live gameplay without corrupting host state
   1. implemented baseline:
      1. stable controller device identity
      2. room-scoped resumable player-slot lease
      3. same-device automatic resume attempt
      4. conflicting-device resume rejection
   2. remaining release gate:
      1. `pong` now has local Arcade browser proof for reconnect/resume after controller refresh
      2. prove the same trust bar in real Arcade gameplay for `air-capture` and `last-band-standing`
      3. confirm host/runtime behavior stays stable when reconnect attempts happen mid-match
   3. broader "continuous player device save system" can remain a later expansion if the smaller resume baseline solves the trust problem cleanly
   4. implementation details live in [Controller Reconnect And Resume Plan](./controller-reconnect-resume-plan.md)
2. add a consistent controller-open fullscreen prompt for Arcade and game controller surfaces
   1. this should be a user-gesture-driven prompt, not a silent forced fullscreen call
   2. current truth:
      1. the prompt now appears on room-backed controller open
      2. controller-local browser smoke covers the prompt explicitly
      3. existing Pong and `air-capture` controller smokes now dismiss it as part of the product contract
3. improve `air-capture`'s high-priority gameplay clarity and correctness:
   1. current truth:
      1. controller playing UI now uses a real left-side analog movement stick and keeps the right side focused on `Ability` + `Shoot`
      2. a team can no longer pick up the enemy flag while its own flag is already being carried
      3. rocket blast was tuned into a larger distance-scaled AOE so it reads clearly in live play
      4. player names are now visible in the lobby on both host and controller surfaces
      5. match start now goes through a 3-second countdown phase where pilots can rotate but cannot thrust or fire
   2. remaining release gate:
      1. rerun real Arcade playtests for `air-capture` and confirm these fixes actually improve the trust/readability bar in live play
4. rerun `air-capture` and `last-band-standing` local Arcade proof after the above fixes and record whether they remain in the launch set without qualification
5. if any SDK/platform work lands here, realign:
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
