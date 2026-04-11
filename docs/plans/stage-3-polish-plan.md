# Air Jam Stage 3 Polish Plan

Last updated: 2026-04-09  
Status: active

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [V1 Release Launch Plan](./v1-release-launch-plan.md)
3. [Final Prerelease Manual Check Plan](./final-prerelease-manual-check-plan.md)
4. [Visual Review Harness Plan (Archived)](../archive/visual-review-harness-plan-2026-04-09.md)
5. [Public Arcade Release Strategy](../strategy/public-arcade-release-strategy.md)

## Purpose

Turn the now-stable launch set into a release-presentable product surface.

This plan exists to keep Stage 3 concrete and bounded:

1. improve first impression
2. improve host/controller readability and responsiveness
3. tighten gameplay feel where roughness is obvious
4. avoid reopening architecture unless a real polish blocker proves it is necessary

## Scope

This plan covers:

1. shared host/controller shell polish
2. launch-set visual harness review and targeted cleanup
3. small gameplay-feel improvements that materially affect release quality

This plan does not cover:

1. new feature work
2. broad framework refactors
3. final manual prerelease proof
4. uploads, media, deploy, or launch execution

## Current Baseline

Already true:

1. the shared Arcade-built lobby sweep is green for all five launch games
2. host/controller launch flows are stable enough to use captures as a real polish baseline
3. preview-controller and agent-runtime alignment work are no longer active blockers
4. the neutral shared-shell polish pass is now materially landed across the common SDK and platform shell surfaces
5. refreshed `arcade-built` lobby captures are green again for `pong`, `air-capture`, `code-review`, `last-band-standing`, and `the-office`

That means the next job is not to keep chasing speculative breakage.
The next job is to make the shipped surfaces feel intentional.

## Workstreams

### Workstream 1. Shared Shell Polish

Do the cross-game polish first, before touching game-specific screens.

Update:

1. the first neutral-platform shell pass is implemented
2. the runtime header, connection pill, join URL controls, platform Arcade chrome, controller menu/fullscreen prompt, and preview dock/surface now share a calmer neutral shell language
3. the next remaining work is no longer broad shell cleanup; it is the bounded game-by-game polish pass

Focus:

1. Arcade host chrome clarity
2. QR / join URL / copy-open affordance clarity
3. controller shell density, readability, and spacing
4. loading, blocked, and embedded-frame states
5. preview-controller dock presentation and coexistence quality

Done when:

1. the shared shell no longer feels transitional or dev-only
2. host and controller entry surfaces feel consistent across the launch set
3. no obvious shell rough edge undercuts the games before gameplay even starts

### Workstream 2. Launch-Set Host/Controller Polish

After the shell pass, do one short polish pass per launch game:

1. `pong`
2. `air-capture`
3. `code-review`
4. `last-band-standing`
5. `the-office`

For each game:

1. inspect current visual captures
2. run one short live host/controller pass
3. fix only high-signal issues
4. regenerate the same capture baseline

Focus:

1. lobby clarity
2. readability during active play
3. ended/result-state quality
4. obvious mobile controller issues
5. obvious first-impression presentation issues

### Workstream 3. Gameplay Feel Tightening

Only do the small gameplay improvements that clearly change release quality.

Focus:

1. countdown/start clarity
2. feedback timing
3. pacing roughness
4. obviously weak audio/interaction feedback

Rule:

1. if a change becomes system work, stop and reassess
2. if a change is subtle and low-signal, do not let it expand the polish pass

## Suggested Execution Order

1. finish shared shell polish
2. do one bounded launch-set polish pass in game order
3. rerun the relevant visual captures
4. carry only the remaining obvious release-facing roughness into prerelease cleanup

## Working Rule

This is a release-polish pass, not an architecture phase.

If a task is:

1. a blocker bug, it belongs back in fixes
2. a framework refactor, it should be cut unless clearly necessary
3. a minor nice-to-have, it should move to `docs/suggestions.md` after release

## Done Criteria

This plan is complete when:

1. the launch-set shared shell feels intentional and presentable
2. each launch game has had one focused high-signal polish pass
3. refreshed captures are good enough to support the final prerelease overpass
4. remaining nits are either cleanup-stage items or safe post-release follow-ups
