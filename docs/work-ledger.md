# Air Jam Work Ledger

Last updated: 2026-03-31  
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
Reference: [Air Capture Reference Refactor Plan](./plans/air-capture-reference-refactor-plan.md)

Remaining:

1. keep the email/password fallback for the initial release while GitHub remains the primary auth path
2. finish the last `air-capture` engine-boundary pass so simulation-heavy logic keeps moving out of entity components where a pure seam exists
3. decide which legacy showcase games need full modern reference alignment instead of migration-proof only
4. get the five-game public launch set working locally through Arcade
5. move anything else non-essential to `docs/suggestions.md`

Completed in this track:

1. `air-capture` now has a modern host/controller/domain/store/engine/prefab/ui/debug/audio structure
2. `air-capture` now has explicit team-slot and arena prefab contracts instead of looser mixed seams
3. `air-capture` now has focused domain/prefab/store/engine tests with a 71-test passing baseline
4. local Arcade manual validation confirmed the refactor preserved host/controller/lobby/match/return flows

Rule:

1. do this in parallel only when it does not delay priorities 1 through 3
2. move anything non-essential to `docs/suggestions.md`

### Priority 5. Release PR And Publish

Status: active  
Plan: [V1 Release Launch Plan](./plans/v1-release-launch-plan.md)

Remaining:

1. create final release media for the five-game launch set
2. connect and deploy all public games on official hosting
3. validate all five games against the official servers
4. merge the release PR and deploy the platform
5. publish the release and ZeroDays articles
6. execute the first GTM and community rollout

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

### 8. Platform Dashboard Account Auth

Status: active  
Plan: [Platform Dashboard Account Auth Plan](./plans/platform-dashboard-account-auth-plan.md)

Current view:

1. GitHub-first auth is now implemented as the correct v1 baseline
2. production GitHub OAuth is configured and working
3. the email/password fallback is intentionally kept for the initial release
4. this should stay clearly separate from runtime/framework auth hardening

### 9. Public Arcade Artifact Release Model

Status: active  
Plan: [Public Arcade Artifact Release Plan](./plans/public-arcade-artifact-release-plan.md)  
Strategy: [Public Arcade Release Strategy](./strategy/public-arcade-release-strategy.md)

Current view:

1. self-hosting should remain first-class for framework adoption and external runtime use
2. public Arcade should move away from mutable creator-controlled URLs toward immutable Air Jam-hosted releases
3. this is a substantial platform product slice, but it meaningfully reduces long-term moderation, trust, and release-management complexity
4. the first implementation should stay static-artifact focused and should not become a general-purpose Vercel clone
5. the schema, release router baseline, and R2-backed artifact upload/finalization boundary now exist in the platform app
6. structural archive validation is now implemented as the first blocking release check
7. the dashboard now has a dedicated Releases surface and overview/sidebar entry points for the hosted release lane
8. public Arcade and public play now resolve only live hosted releases, while owner preview can still use an optional preview URL when configured
9. publish-time screenshot capture and image moderation now run against the canonical hosted release before it can go live
10. public play can now file abuse reports against the hosted release itself, and the release dashboard now surfaces checks plus incoming reports
11. the dashboard IA has now been reset around `Overview`, `Arcade Releases`, `Media`, `Security`, and `Analytics`
12. the old `isPublished` contract has now been replaced by `arcadeVisibility: hidden | listed` across schema, public filters, and dashboard controls
13. old `/settings` and `/self-hosted` now redirect back into `Overview`, and release actions now use `Make Live` / `Listed in Arcade` language instead of the old overloaded publish wording
14. the game URL field is now an optional creator-only preview URL, not a required game primitive, and owner play falls back to the live hosted release when no preview URL exists
15. `Listed in Arcade` is now enforced as a dependent state of a live hosted release instead of a free toggle, and legacy rows without a live release have been reset back to `hidden`
16. local platform development now has a dev-only local Arcade catalog seam so repo reference games can appear in the Arcade browser without weakening the real hosted-release contract
17. game media is now a managed subsystem with `game_media_assets`, active media slots on `games`, a dedicated `Media` page, and stable `/media/g/{gameId}/{kind}` serving routes
18. the old raw `thumbnail_url`, `cover_url`, and `video_url` columns have now been removed from `games`

Remaining:

1. run one end-to-end hosted release smoke path through the dashboard against the new R2-backed flow
2. decide whether browser-backed screenshot moderation stays optional for v1 or becomes required before launch infra is frozen
3. do one end-to-end managed media smoke path through the new dashboard page and public catalog surfaces
4. add an internal ops review surface only if report volume or moderation triage actually demands it before release

### 10. SDK Composability

Status: parked  
Plan: [SDK Composability Plan](./plans/sdk-composability-plan.md)

Current view:

1. good architecture direction
2. not on the immediate prerelease critical path unless it unblocks release UX

### 11. SDK Runtime Ownership Reset

Status: active  
Plan: [SDK Runtime Ownership Reset Plan](./plans/sdk-runtime-ownership-plan.md)

Current view:

1. prerelease should not ship with abuse-prone owner-hook patterns for singleton runtime systems
2. explicit runtime ownership is now the preferred direction for host, controller, and audio
3. Pong, `air-capture`, template output, and docs should converge on one canonical runtime pattern
4. deprecated compatibility surface should not be left behind here

### 12. Platform Settings Runtime

Status: completed baseline  
Plan: [Platform Settings Runtime Plan](./plans/platform-settings-runtime-plan.md)

Current view:

1. shared user settings should be a platform-owned runtime, not an audio-only global store
2. Arcade/platform should persist shared settings locally and inherit them into child game iframes
3. embedded games should consume platform settings read-only
4. the initial shared schema should stay intentionally small: audio, accessibility, and feedback
5. Arcade browser chrome and controller menu are now the canonical product surfaces for shared settings instead of leaving the runtime as latent plumbing only
6. initial iframe settings delivery is now deterministic via explicit `AIRJAM_SETTINGS_READY` handshake and SDK-owned bridge helpers
7. controller-side setting changes now flow through host-owned room authority, not same-origin storage assumptions
8. audio startup is now explicit and observable with runtime `idle | blocked | ready` state plus a host-facing enable-audio prompt when the browser blocks autoplay

### 13. RPC Action Contract Refactor

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
8. prerelease production observability baseline is now explicit across Better Stack uptime, Vercel Web Analytics, Vercel Speed Insights, and Air Jam's own runtime analytics
9. the platform dashboard now exposes a direct bug-report path to the official GitHub issues surface
10. `air-capture` now teaches the modern reference architecture and has passed manual Arcade validation after the current refactor phases

## Rules

1. If a repo-level track matters now, it must appear here.
2. If a plan is active, it must be linked here.
3. If a plan is completed, archive it or mark it non-active here immediately.
4. Keep this file ordered by real execution priority, not by category alone.
5. Keep `docs/suggestions.md` limited to durable non-critical follow-ups.
