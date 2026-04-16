# Air Jam Stage 3 Polish Plan

Last updated: 2026-04-15  
Status: archived

Archive reason: the shared-shell pass and the per-game polish sweep are landed for the launch set, captures are green again, and the plan's own rule says to stop Stage 3 and hand off to the final manual proof if no new high-signal issue appears. Any remaining polish-shaped item now surfaces as a finding inside [Final Release Checks Plan](../plans/final-release-checks-plan.md) and loops back into [Final Prerelease Hardening And Cleanup Plan](../plans/final-prerelease-hardening-and-cleanup-plan.md) if it turns out to matter for launch.

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [V1 Release Launch Plan](../plans/v1-release-launch-plan.md)
3. [Final Release Checks Plan](../plans/final-release-checks-plan.md)
4. [Visual Review Harness Plan (Archived)](./visual-review-harness-plan-2026-04-09.md)
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

Additional current truth:

1. the visual harness is still useful, but it is no longer treated as the primary visual-inspection path for agents or humans during everyday game work
2. browser-driven inspection and interaction are now the default visual path, while the harness remains valuable for deterministic setup, machine-readable state, and future evaluation automation
3. repo validation truth is restored all the way through `pnpm run check:release`, including perf sanity, browser smoke, and scaffold smoke

## Workstreams

### Workstream 0. Validation Truth And Harness Cleanup

Before more game polish, restore truthful prerelease validation.

Status update:

1. completed on 2026-04-14
2. the shared visual-harness generic/typecheck break is repaired
3. the harness stays as optional advanced support rather than the primary visual-development path
4. root lint and typecheck are back to green after the harness fix
5. the full prerelease release gate is green again, so Stage 3 no longer needs to carry repo-truth repair as active work

Focus:

1. resolve current repo typecheck and lint failures
2. repair the current visual-harness generic/typecheck path across the shared package and affected launch games
3. keep the visual harness as optional advanced support instead of removing it or pretending it is the default authoring path
4. if any template/scaffold story still over-emphasizes the harness as a normal game-authoring concern, reduce that emphasis while keeping the advanced lane documented

Done when:

1. launch-set validation is not red because of known harness breakage
2. the harness has one clear role: deterministic advanced support, not mandatory everyday authoring glue
3. repo docs and template truth match that decision
4. Stage 3 polish can proceed without carrying a known validation lie

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
6. gameplay feel where roughness is obvious enough to undercut release quality

Current next priorities:

1. `last-band-standing`: do one bounded UI uplift only if the final manual pass still shows an obvious release-facing rough edge
2. run one short high-signal sweep across `pong` and `air-capture` only if the final manual pass surfaces remaining visible nits
3. if no new high-signal issue appears, stop Stage 3 work and hand off to the final prerelease manual proof instead of reopening more polish scope

Status update:

1. `code-review` gameplay feel has a first live tuning pass in place on movement retention and bot pressure
2. `the-office` controller contrast/background treatment is corrected
3. `last-band-standing` URL/embed validation is confirmed clean through the real `songs:validate` script and current song bank
4. `code-review` is now structurally aligned with Pong and the scaffold guidance: gameplay simulation, bot behavior, render helpers, and pure store transitions are extracted out of the host route, and the scaffold source mirrors that cleanup
5. the remaining question for this launch-game slice is whether `last-band-standing` still needs one bounded UI uplift after the now-verified media path

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

1. keep Workstream 0 closed unless the release gate regresses again
2. finish only the remaining bounded launch-game polish that survives live/manual proof
3. rerun only the relevant visual captures and targeted live checks for that bounded fallout
4. carry any remaining obvious release-facing roughness into prerelease cleanup or the final manual overpass

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
