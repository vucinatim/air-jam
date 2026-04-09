# Air Jam Work Ledger

Last updated: 2026-04-09  
Status: active

This is the single active repo-wide ledger.

Use it to answer:

1. what matters now
2. what is already done
3. which active plans still matter
4. which tracks were archived or collapsed

## Current Execution Order

Air Jam should now move through prerelease work in this order:

1. finish the remaining prerelease implementation in [Prerelease Systems Closeout Plan](./plans/prerelease-systems-closeout-plan.md)
2. finish or explicitly cut the preview-controller feature in [Controller Preview Dock Plan](./plans/controller-preview-dock-plan.md)
3. run the single final manual proof pass in [Final Prerelease Manual Check Plan](./plans/final-prerelease-manual-check-plan.md)
4. create release media assets
5. connect and deploy all public games on official hosting
6. validate all public games against the official servers
7. merge the release PR, deploy the platform, publish content, and execute launch distribution

Canonical prerelease plan: [V1 Release Launch Plan](./plans/v1-release-launch-plan.md)

## Audit Summary

After the 2026-04-09 planning audit:

1. several plans were archived because their implementation was already complete or only manual verification remained
2. the active implementation surface is now intentionally small
3. all scattered manual verification now belongs in one final prerelease plan instead of staying spread across subsystem docs

## Active Plans

### Priority 1. Canonical Release Execution

Status: active  
Plan: [V1 Release Launch Plan](./plans/v1-release-launch-plan.md)

Still open here:

1. release media assets
2. official hosting and platform connection
3. official server validation
4. release merge, platform deploy, release content, and GTM execution

### Priority 2. Prerelease Systems Closeout

Status: active  
Plan: [Prerelease Systems Closeout Plan](./plans/prerelease-systems-closeout-plan.md)

Real remaining implementation after audit:

1. resolve the remaining SDK cleanup decisions honestly
2. finish the last worthwhile visual-harness closeout work
3. align docs and scaffold guidance with the audited post-archive reality

### Priority 3. Preview Controllers

Status: active  
Plan: [Controller Preview Dock Plan](./plans/controller-preview-dock-plan.md)

Current truth:

1. this feature is still genuinely unfinished
2. the shared preview-controller product/runtime layer is not yet implemented
3. the platform controller route still needs the planned cleanup if preview mode is going to ship
4. if it is not clearly complete before the final manual prerelease check begins, it should be cut from v1

### Priority 4. Final Manual Release Proof

Status: planned  
Plan: [Final Prerelease Manual Check Plan](./plans/final-prerelease-manual-check-plan.md)

This plan now owns:

1. local Arcade and phone/controller proof for the five launch games
2. dashboard hosted-release and managed-media proof
3. official hosted-platform and official-server proof
4. final launch-set go / no-go recording

## Completed / Archived Baselines

These plans were removed from the active surface in the 2026-04-09 cleanup:

1. [Standard Lifecycle Contract Plan](./archive/standard-lifecycle-contract-plan-2026-04-09.md)
2. [Composition Shell Contract Plan](./archive/composition-shell-contract-plan-2026-04-09.md)
3. [Showcase Games Release Readiness Plan](./archive/showcase-games-release-readiness-plan-2026-04-09.md)
4. [Showcase Games Release Readiness Checklist](./archive/showcase-games-release-readiness-checklist-2026-04-09.md)
5. [Public Release Security Hardening Plan](./archive/public-release-security-hardening-plan-2026-04-09.md)
6. [SDK Extraction Clean-Swap Plan](./archive/sdk-extraction-clean-swap-plan-2026-04-09.md)
7. [Visual Review Harness Plan](./archive/visual-review-harness-plan-2026-04-09.md)

Why they were archived:

1. implementation was already complete enough to stop driving day-to-day work
2. or the only remaining steps were manual verification, which now belongs in the final manual prerelease plan
3. or the old broader plan was superseded by a smaller truthful closeout plan

## Latest Repo Truth

The audit confirmed:

1. the standard lifecycle reset is done
2. the composition shell rollout is code-complete
3. the showcase-game implementation pass is code-complete enough that it no longer needs a separate active implementation plan
4. the public-release security blocker set is closed
5. the visual harness is already implemented as a real package with launch-set lifecycle coverage
6. the hosted release and managed media lanes are implemented product surfaces; what remains is end-to-end proof, not building those systems
7. the preview-controller dock remains the only clearly unfinished prerelease feature plan

## Documentation Hygiene Tasks

Status: ongoing repo rule

Remaining:

1. keep this ledger as the single active execution surface
2. keep the active plan set minimal and truthful
3. archive plans as soon as implementation is complete or only manual proof remains
4. keep active docs aligned with the real repo state instead of stale plan intent

## Rules

1. If a repo-level track matters now, it must appear here.
2. If a plan is active, it must be linked here.
3. If a plan is completed, superseded, or only blocked on manual proof, archive it.
4. Keep this file ordered by real execution priority, not by category alone.
5. Keep `docs/suggestions.md` limited to durable non-critical follow-ups.
