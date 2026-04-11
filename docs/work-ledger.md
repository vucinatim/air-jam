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
2. the active implementation surface is now intentionally empty
3. all scattered manual verification now belongs in one final prerelease plan instead of staying spread across subsystem docs

## Active Plans

### Priority 1. Canonical Release Execution

Status: active  
Plan: [V1 Release Launch Plan](./plans/v1-release-launch-plan.md)

Still open here:

1. sequence and coordinate the full release path after prerelease implementation is done
2. cover hosted uploads, media/blogs, live deploy, and launch execution

### Current Focus. Stage 3 Polish

Status: active execution focus
Plan: [Stage 3 Polish Plan](./plans/stage-3-polish-plan.md)

Immediate next work:

1. the first shared shell polish pass is now landed across the common SDK and platform shell surfaces
2. refreshed `arcade-built` lobby captures are green again for all five launch games after that shell pass
3. the next honest work is one bounded high-signal polish pass across the five launch games
4. only reopen Stage 2 fixes if a real blocker appears during game-specific polish

### Recently Completed Implementation Track. Agent Runtime Contract Alignment

Status: completed  
Plan: [Agent Runtime Contract Plan](./archive/agent-runtime-contract-plan-2026-04-09.md)

Current truth:

1. the long-term vision now explicitly includes a future where agents can build, run, inspect, control, and iteratively polish games through Air Jam-native contracts
2. the SDK surface audit now explicitly classifies the current public lanes
3. `@air-jam/sdk`, `@air-jam/sdk/ui`, and `@air-jam/sdk/styles.css` are the intended durable prerelease authoring/UI lanes
4. `@air-jam/sdk/preview`, `@air-jam/sdk/arcade*`, `@air-jam/sdk/protocol`, `@air-jam/sdk/contracts/v2`, `@air-jam/sdk/runtime-control`, `@air-jam/sdk/runtime-inspection`, and `@air-jam/sdk/runtime-observability` are intentionally experimental leaves
5. future machine-facing seams now have explicit experimental SDK homes instead of staying only internal
6. `@air-jam/sdk/runtime-control` exposes additive host/controller session-driving adapters over the mounted runtime owners
7. `@air-jam/sdk/runtime-inspection` exposes structural host/controller runtime snapshots instead of UI scraping
8. `@air-jam/sdk/runtime-observability` exposes a typed subscription/filter layer over the canonical `AIRJAM_DEV_RUNTIME_EVENT` stream instead of a second logging path
9. the first canonical game-capability home now exists: declarations live in `airjam.config.ts`, while the capability schema itself lives in the explicit experimental leaf `@air-jam/sdk/capabilities`
10. the prerelease alignment spine is now in place: surface classification, explicit experimental machine-facing leaves, and an experimental capability declaration home are all explicit

### Recently Completed Implementation Track. Prerelease Systems Closeout

Status: completed  
Plan: [Prerelease Systems Closeout Plan](./archive/prerelease-systems-closeout-plan-2026-04-09.md)

Current truth:

1. the SDK-owned platform-settings boundary cleanup and host join-url cleanup are done
2. docs and scaffold guidance are aligned with that post-audit SDK truth
3. built-mode repo visual capture now reuses unchanged game dist artifacts instead of always rebuilding
4. the deferred harness-driven UI cleanup now belongs to the later polish stage, not an active implementation plan
5. the first follow-on fix is done: Arcade now carries explicit `controllerUrl` ownership and the Pong Arcade-built lobby capture passes again

### Recently Completed Implementation Track. Preview Controllers

Status: completed  
Plan: [Controller Preview Dock Plan](./archive/controller-preview-dock-plan-2026-04-09.md)

Current truth:

1. the platform controller route split is complete, including a thin preview-surface mode that reuses the real controller path
2. the SDK now exposes a real `@air-jam/sdk/preview` leaf with shared launch, identity, manager, surface, dock, and host-wrapper ownership
3. platform `/arcade` and `/play`, plus all five launch-set repo and scaffold host flows, now consume that same shared preview path in local dev
4. automated preview-identity uniqueness coverage exists at the launch/manager layer
5. live mixed-session proof passes on both a standalone Pong host and the platform Arcade path
6. preview close/reopen behavior passes with a fresh preview identity on reopen while the phone controller remains connected
7. docs and scaffold guidance are aligned enough for prerelease use
8. the first-use desktop-width pass holds at 1440, 1100, and 960 wide without losing the QR/controller-link or `Add controller` affordance

### Priority 2. Final Manual Release Proof

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
8. [Controller Preview Dock Plan](./archive/controller-preview-dock-plan-2026-04-09.md)
9. [Agent Runtime Contract Plan](./archive/agent-runtime-contract-plan-2026-04-09.md)
10. [Prerelease Systems Closeout Plan](./archive/prerelease-systems-closeout-plan-2026-04-09.md)

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
7. the preview-controller dock is now complete enough to be archived out of the active implementation surface
8. the SDK-owned platform-settings boundary cleanup and host join-url cleanup are now complete
9. the platform controller page is now split into cleaner runtime, frame/bridge, and presentation layers as the first preview-controller prerequisite
10. the canonical preview URL builder now exists as a dedicated SDK leaf instead of being left to app-level glue
11. the first docked preview-controller platform integration now exists as a host-local overlay, not as replicated arcade state
12. the shared preview UI is now proven by both platform and a repo/scaffold game host consumer instead of only one surface
13. the last systems-closeout iteration-speed task is done: repo visual capture in `arcade-built` mode now reuses unchanged game builds
14. Arcade launch flows no longer infer controller runtime URLs only from host URLs; catalog entries now carry explicit `controllerUrl` values, which fixes the Pong Arcade-built recursive controller-shell bug
15. the `air-capture` three-profile build no longer over-splits React and app runtime code; the Arcade-built host/controller lobby baseline now captures successfully instead of crashing on a bundled runtime cycle
16. the shared Stage 2 fix-pass sweep is green for the launch set at the Arcade-built lobby baseline: all five launch games now produce captured host/controller artifacts through the platform Arcade shell
17. the repo is now ready to move from shared blocker hunting into Stage 3 polish, with one bounded polish plan driving the next pass
18. the shared shell no longer depends on rough transitional styling alone: the runtime header, connection pill, join controls, platform Arcade chrome, controller menu/fullscreen prompt, and preview dock/surface now share a calmer neutral shell treatment by default
19. refreshed `arcade-built` lobby capture metadata is green again for `pong`, `air-capture`, `code-review`, `last-band-standing`, and `the-office` after the shared-shell pass

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
