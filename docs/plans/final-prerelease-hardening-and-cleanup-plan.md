# Air Jam Final Prerelease Hardening And Cleanup Plan

Last updated: 2026-04-18  
Status: active closeout

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [V1 Release Launch Plan](./v1-release-launch-plan.md)
3. [Final Release Checks Plan](./final-release-checks-plan.md)
4. [Project Review (2026-04-15)](../strategy/project-review-2026-04-15.md)
5. [Production Observability Baseline](../strategy/production-observability-baseline.md)
6. [Public Arcade Release Strategy](../strategy/public-arcade-release-strategy.md)

## Purpose

Run one last bounded fix/improve/polish pass before the final manual prerelease overpass.

This plan exists to convert the useful parts of the 2026-04-15 project review into one explicit execution track without reopening broad architecture work.

Important rule:

1. [Work Ledger](../work-ledger.md) remains the execution source of truth
2. the project review is a snapshot input, not a second active tracker
3. once this plan is done, execution should move directly into the final manual prerelease proof and then release execution

## Scope

This plan covers:

1. release-time ops guardrails that are still too weak or missing
2. platform abuse hardening and public-surface cleanup
3. small data-contract tightening that is cheap and high-leverage before external creator growth
4. release-facing cleanup where tooling or dead paths still leak into shipped product surfaces
5. docs alignment where the current review snapshot needs to be reconciled against current repo truth

This plan does not cover:

1. multi-instance server work such as Redis adapters, sticky sessions, or distributed rate limits
2. broad SDK/runtime/component refactors driven mainly by file size or aesthetics
3. sandbox quotas, moderation dashboard work, analytics queueing, or feature-flag systems
4. monetization hooks or speculative future product work
5. final manual prerelease proof, uploads, deploy, or launch distribution

## Current Baseline

Already true:

1. the canonical prerelease gate is green again through `pnpm run check:release` as of 2026-04-18
2. the public-release blocker set was already narrowed enough that the repo moved back into polish and release execution mode
3. exported experimental SDK leaves are now explicitly limited to `preview`, `arcade*`, `protocol`, `capabilities`, `metadata`, and `prefabs`; the machine-facing `runtime-control`, `runtime-inspection`, `runtime-observability`, and `contracts/v2` seams remain in-source but private
4. the remaining work is now best described as last-mile hardening and cleanup, not major implementation

That means this plan should stay small and selective.

If a task does not materially improve launch safety, release clarity, or near-term creator correctness, it should be cut from this pass.

Current closeout truth:

1. Workstream 2 is materially done for v1: platform Sentry, real health/readiness, payload limits, and maintenance mode are landed. Broader server/runtime release tracking is a follow-up choice, not an untracked blocker.
2. Workstream 3 is done for v1: sensitive write-path rate limiting, security headers, and dead route cleanup are landed.
3. Workstream 4 is landed for v1: `games.user_id`, typed `games.config`, SDK compatibility docs, SDK metadata helpers, first-party `gameMetadata` exports, scaffold-source adoption, and the template-manifest `category` contract are in place.
4. Workstream 5 no longer hides a blocker: the public export surface is intentionally narrower than the old docs implied, and `air-capture`'s prefab-preview remains dev-only and tree-shaken from production.

## Workstreams

### Workstream 1. Review And Docs Truth Alignment

Make the review-derived work truthful and bounded before using it to drive code changes.

Focus:

1. add an explicit note to the project review that it is a snapshot and not the execution source of truth
2. reconcile review conclusions against the current work ledger and current repo state
3. rewrite the release-facing recommendation section into clear execution buckets:
   1. do now
   2. do soon
   3. later
   4. reject or cut
4. correct the stale or overstated review items:
   1. test coverage wording for `code-review`, `the-office`, and `last-band-standing`
   2. input-schema divergence is not itself a problem
   3. AI-Studio runtime leaves are already explicitly marked experimental
   4. `AirJamActionContext` actor-verification concern should be marked `needs audit`

Done when:

1. the review doc no longer fights the work ledger
2. the team can use the review as input without turning it into a second tracker
3. the resulting action list is small, explicit, and release-shaped

### Workstream 2. Release Ops Guardrails

Land the cheap operational safeguards that are still too weak for launch.

Focus:

1. add error tracking across the real release surfaces
2. upgrade `/health` from `{ ok: true }` to a real readiness signal
3. add explicit payload size limits on server request parsing
4. add a simple maintenance or kill-switch path for new public runtime activity

Rules:

1. do the smallest correct implementation that gives real launch leverage
2. do not turn this into an observability-platform project
3. prefer baseline signal and control over dashboard richness

Done when:

1. launch-day failures are visible
2. uptime monitoring can distinguish healthy from broken
3. trivial oversized-request footguns are removed
4. there is one intentional path to stop new activity if the public system needs to be paused

### Workstream 3. Platform Abuse Hardening And Surface Cleanup

Tighten the platform surfaces that are still too permissive or confusing for release.

Focus:

1. add abuse throttling for the sensitive write paths:
   1. sign-up
   2. `game.create`
   3. `release.createDraft`
   4. `gameMedia.*`
2. run the platform security-header audit and land the required baseline headers for the actual embed model
3. delete the dead local-build route trees so only the live path remains

Rules:

1. bias toward simple repo-local rate limiting for v1
2. security-header work should match the real iframe/embed model, not generic defaults alone
3. dead route removal should prefer deletion over compatibility shims

Done when:

1. obvious platform write-abuse paths are no longer unguarded
2. the public platform surface has a minimal intentional header posture
3. release-facing route ownership is clear and non-duplicated

### Workstream 4. Data And Metadata Contract Tightening

Fix the cheap schema and metadata gaps that will become expensive once creator and catalog usage spreads.

Focus:

1. add the missing `games.user_id` index
2. stop treating `games.config` as an unowned JSON bucket
3. define the minimum typed game metadata contract needed before external creator onboarding
4. add the small SDK compatibility-policy paragraph that tells creators what versioning floor they can expect

Rules:

1. prefer a typed canonical metadata contract over a file-format-first argument
2. keep the first contract small and launch-shaped
3. only pull metadata into this pass if it clearly affects creator correctness or future migration cost

Done when:

1. the common game ownership lookup is indexed
2. game config/metadata stops drifting as unconstrained JSON
3. third-party onboarding would have one clear metadata shape to target
4. SDK compatibility expectations are explicit in docs

### Workstream 5. Release-Facing Product Cleanup

Remove or relocate the release-facing seams that still leak tooling into shipped product surfaces.

Focus:

1. extract or otherwise remove `air-capture` prefab-preview ownership from the shipping game path
2. act on drop or defer decisions that fall out of the experimental SDK subpath export audit

The audit itself lives in [Final Release Checks Plan](./final-release-checks-plan.md) Workstream E. This workstream owns the implementation follow-through only: drop exports that fail the three-part test, defer exports that pass but are not yet ready, and keep the named leaves that pass.

Rules:

1. do not collapse explicit named experimental leaves into one generic `/experimental` bucket
2. do not keep an exported leaf only because it might be useful later
3. do not reopen broad SDK surface redesign unless the audit finds a concrete unjustified leaf

Done when:

1. `air-capture` no longer carries avoidable dev-harness ownership in its shipped app path
2. every kept experimental export has a documented reason to exist now
3. this pass ends with a cleaner release surface, not a larger architecture debate

## Explicit Cuts From This Pass

These ideas are valid but should not be allowed to reopen prerelease scope here:

1. multi-instance server scaling work
2. Prometheus or OTel rollout
3. analytics queue or batching architecture
4. per-room rate limits
5. moderation dashboard implementation
6. first-party asset CDN work
7. feature-flag system rollout
8. monetization hooks
9. generic game-template extraction
10. input-schema standardization across games
11. refactoring giant hooks or giant UI components unless one blocks a scoped change in this plan

## Suggested Execution Order

1. align the review doc and execution buckets first so the pass stays bounded
2. land release ops guardrails next
3. tighten platform abuse/security and delete dead public routes
4. land the small data/metadata hardening items
5. finish the release-facing cleanup pass on prefab-preview and experimental export ownership
6. hand off to [Final Release Checks Plan](./final-release-checks-plan.md) for the consolidated gate rerun, SDK export audit, and manual proof passes

## Done Criteria

This plan is complete when:

1. the review-derived action list is reconciled and truthful
2. the release surfaces have the missing basic guardrails they still need
3. the platform no longer carries obvious dead public routes or unthrottled sensitive writes
4. the cheap metadata/schema fixes are landed before wider creator usage
5. the shipped product surface no longer leaks known dev-tooling seams that should have been extracted
6. the repo is ready to move from this final hardening pass into the last manual prerelease overpass without starting another implementation track
