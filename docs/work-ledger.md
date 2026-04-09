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

1. finish all remaining implementation work up front
2. run the immediate post-implementation fix pass
3. do UI and gameplay polish
4. do prerelease cleanup
5. run prerelease devex and SDK checks
6. run prerelease security checks
7. run the final prerelease overpass in [Final Prerelease Manual Check Plan](./plans/final-prerelease-manual-check-plan.md)
8. finish final docs alignment and polish
9. upload the games
10. finish media, blogs, and final landing-page overlook
11. merge into `master`, deploy, and test live
12. lock the release plan and do launch distribution / manual marketing

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

1. sequence and coordinate the full release path after prerelease implementation is done
2. cover hosted uploads, media/blogs, live deploy, and launch execution

### Priority 2. Prerelease Systems Closeout

Status: active  
Plan: [Prerelease Systems Closeout Plan](./plans/prerelease-systems-closeout-plan.md)

Real remaining implementation after audit:

1. use the existing visual harness for targeted UI cleanup and reduce avoidable rebuild/boot churn
2. keep docs and scaffold guidance aligned when that harness cleanup changes contracts or workflow

### Priority 3. Preview Controllers

Status: active  
Plan: [Controller Preview Dock Plan](./plans/controller-preview-dock-plan.md)

Current truth:

1. this feature is still genuinely unfinished
2. the platform controller route split is now complete, including a thin preview-surface mode that reuses the real controller path
3. the SDK now exposes a real `@air-jam/sdk/preview` leaf with a canonical preview launch URL builder
4. preview device-identity override now exists as a narrow controller-runtime path instead of a general runtime expansion
5. the first host-local preview session manager, shared preview surface, and shared preview dock now live in the SDK preview leaf
6. platform `/arcade` and `/play`, plus the Pong repo/scaffold host flow, now consume that same shared preview UI
7. the remaining real slices are concurrent preview identity validation, broader consumer rollout decisions, and final mixed-session proof
8. under the new execution order, this should be finished during the upfront implementation stage rather than deferred until late prerelease

### Priority 4. Final Manual Release Proof

Status: planned  
Plan: [Final Prerelease Manual Check Plan](./plans/final-prerelease-manual-check-plan.md)

This plan now owns:

1. local Arcade and phone/controller proof for the five launch games
2. dashboard hosted-release and managed-media proof
3. official hosted-platform and official-server proof
4. final launch-set go / no-go recording

Execution note:

1. this plan is intentionally late in the sequence
2. it should begin only after implementation, fixes, polish, cleanup, devex checks, and security checks are complete enough that the overpass is meaningful

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
8. the SDK-owned platform-settings boundary cleanup and host join-url cleanup are now complete
9. the platform controller page is now split into cleaner runtime, frame/bridge, and presentation layers as the first preview-controller prerequisite
10. the canonical preview URL builder now exists as a dedicated SDK leaf instead of being left to app-level glue
11. the first docked preview-controller platform integration now exists as a host-local overlay, not as replicated arcade state
12. the shared preview UI is now proven by both platform and a repo/scaffold game host consumer instead of only one surface

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
