# Prerelease Systems Closeout Plan

Last updated: 2026-04-09  
Status: archived  
Archived on: 2026-04-09

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [V1 Release Launch Plan](../plans/v1-release-launch-plan.md)
3. [Final Prerelease Manual Check Plan](../plans/final-prerelease-manual-check-plan.md)
4. [Controller Preview Dock Plan (Archived)](./controller-preview-dock-plan-2026-04-09.md)
5. [Suggestions](../suggestions.md)
6. [SDK Extraction Clean-Swap Plan (Archived)](./sdk-extraction-clean-swap-plan-2026-04-09.md)
7. [Visual Review Harness Plan (Archived)](./visual-review-harness-plan-2026-04-09.md)
8. [Composition Shell Contract Plan (Archived)](./composition-shell-contract-plan-2026-04-09.md)

## Purpose

Capture only the prerelease implementation work that is still genuinely open after auditing the partially completed system plans.

This plan exists to replace stale active plans whose main implementation already landed, but which still made the active surface look larger and fuzzier than reality.

Archive reason:

1. the last real systems-closeout implementation work is done
2. built-mode repo visual capture now reuses unchanged game build artifacts instead of always rebuilding
3. deferred harness-driven UI cleanup belongs to the later polish stage, not an active implementation plan
4. the remaining Pong Arcade-built lobby timeout is a fix-pass item, not another systems-closeout architecture track

## Audit Outcome

The following tracks are archived because the implementation is effectively complete, superseded, or only had manual verification left:

1. standard lifecycle contract
2. composition shell rollout
3. showcase-game implementation pass
4. public-release security baseline
5. visual harness base system and launch-set lifecycle coverage
6. the broad original SDK extraction plan

The real remaining prerelease implementation surface is narrower:

1. complete the last meaningful SDK cleanup decisions and purge stale plan promises
2. finish the visual-harness closeout work that still improves iteration or product quality
3. keep everything else out of this plan if it is really release proof, operations, or manual QA

## Current Status

Completed on 2026-04-09:

1. the SDK now owns a context-aware platform-settings boundary
2. redundant repo/scaffold/local `PlatformSettingsRuntime` wrappers were removed
3. shared host join shells no longer rebuild fallback controller URLs from `window.location.origin`
4. SDK and scaffold docs now teach the runtime-owned settings boundary and canonical join-url contract

Remaining active work in this plan:

1. visual-harness-powered UI cleanup and iteration-speed closeout

## Scope Lock Decisions

These are the explicit prerelease decisions from the audit.

### Keep For Prerelease

1. finish runtime-owned platform-settings boundary cleanup
2. purge the remaining join-url fallback ambiguity so the SDK teaches one canonical join contract
3. use the existing visual harness for targeted UI cleanup and reduce avoidable rebuild/boot churn where it materially improves iteration

### Cut From This Plan

1. do not keep the old broad SDK extraction promise alive
2. do not create a shared controller connection-notice primitive just because Pong and its scaffold snapshot duplicate a tiny hook
3. do not reopen completed shell, lifecycle, showcase, security, or harness-foundation work

Reasoning:

1. platform-settings ownership and join-url ownership are still real framework seams
2. the connection-notice duplication is too small and too narrow to justify new prerelease abstraction surface
3. the harness system is already built, so only its high-value cleanup/polish remains

## In Scope

### 1. SDK Surface Cleanup

Status: completed on 2026-04-09

Only keep the pieces that are still truly unfinished:

1. implement a clean runtime-owned platform-settings boundary
2. remove the remaining join-url fallback rebuilding from shared shell helpers
3. remove stale repo/scaffold wrappers once the runtime-owned path is in

Exact intended repo changes:

1. add a context-aware platform-settings boundary in the SDK runtime layer so host/controller runtime owners always expose a settings runtime without overriding an outer owner runtime
2. wire that boundary into shared runtime ownership at the SDK runtime layer instead of requiring per-game app wrappers
3. remove manual `PlatformSettingsRuntime` wrappers from repo-owned game app roots and scaffold app roots where they become redundant
4. remove nested `PlatformSettingsRuntime` wrappers from local audio/provider helpers where they become redundant
5. change `useHostLobbyShell` so it stops synthesizing fallback controller URLs from `window.location.origin`
6. make host-shell consumers pass the real join-url readiness contract through instead of relying on fallback reconstruction
7. update SDK docs and scaffold docs so the canonical host join path is “wait for the runtime-owned join URL,” not “rebuild from roomId if needed”

Primary code areas:

1. `packages/sdk/src/settings/platform-settings-runtime.tsx`
2. `packages/sdk/src/runtime/session-runtimes.tsx`
3. `packages/sdk/src/runtime/create-air-jam-app.tsx`
4. `packages/sdk/src/hooks/use-host-lobby-shell.ts`
5. `games/*/src/app.tsx`
6. `packages/create-airjam/scaffold-sources/*/src/app.tsx`
7. `games/air-capture/src/game/audio/*`
8. matching SDK tests and docs

### 2. Visual Harness Closeout

Status: remaining active work

The harness itself is already real. The remaining work is:

1. use the existing launch-set coverage for targeted UI cleanup where artifacts expose real issues
2. extend build/prebuild reuse beyond `@air-jam/sdk` only where it materially improves repeated capture iteration
3. keep new scenario additions narrow and justified by real product cleanup needs

Exact intended repo changes:

1. keep the current `lobby` / `playing` / `ended` launch-set scenario contract as the baseline
2. use those captures to fix concrete host/controller layout and responsiveness problems instead of adding speculative new harness infrastructure
3. improve repo visual-capture iteration speed in the existing repo visual command and stack launch path only where it removes obvious unnecessary rebuild/boot churn
4. avoid adding golden-image or diff infrastructure before release unless a concrete release workflow truly needs it

Primary code areas:

1. `packages/visual-harness/src/*`
2. `scripts/repo/visual/*`
3. `scripts/workspace/lib/*visual*` and related stack launchers
4. `games/*/visual/scenarios.ts`
5. touched game UI surfaces that captures identify as needing cleanup

### 3. Docs And Scaffold Alignment

Status: mostly completed on 2026-04-09 for the SDK/settings/join-url closeout

1. align SDK docs, scaffold docs, and examples with the post-audit truth
2. remove plan language that still promises already-landed work as if it were open
3. keep the generated/scaffold story consistent with the actual SDK surface that remains after cleanup

## Explicit Non-Scope

This plan is not for:

1. final manual release verification
2. dashboard hosted-release proof
3. managed-media proof
4. official-server validation
5. release media creation
6. the preview-controller dock feature, which stays separate because it is still a genuinely unfinished product feature
7. broad new SDK abstractions or configurable framework layers

## Decision Rules

1. If a proposed task is only manual proof, move it to the final manual prerelease plan.
2. If a proposed task is already implemented well enough for release, archive the old plan instead of keeping a fake-active refactor alive.
3. If a proposed SDK cleanup does not clearly reduce decision count, cut it from prerelease scope.
4. Prefer removing stale promises over preserving a larger but less honest active plan surface.

## Execution Workstreams

### Workstream A. Scope Lock

1. keep runtime-owned platform settings cleanup
2. keep join-url contract cleanup
3. cut shared connection-notice extraction from prerelease scope
4. keep harness closeout only as targeted cleanup + iteration-speed work
5. keep docs aligned with these decisions

Done when:

1. there is no stale active plan left for already-landed work
2. the remaining closeout list is explicit, small, and implementation-ready

### Workstream B. SDK Cleanup

Status: completed on 2026-04-09

1. added the SDK-owned platform-settings boundary
2. adopted it in shared runtime ownership
3. removed redundant repo/scaffold/local provider wrappers
4. removed the shared join-url fallback reconstruction path
5. updated host-shell consumers and tests
6. updated docs to teach the final contract

Done when:

1. the SDK and scaffold surface teach one honest canonical path
2. platform settings and join URL no longer depend on scattered game-local glue
3. the cut connection-notice extraction no longer remains in planning limbo

### Workstream C. Harness-Powered UI Cleanup

1. run the existing harness against the launch set when polishing host/controller surfaces
2. fix the highest-value responsiveness or shell-quality issues surfaced by captures
3. improve build reuse or stack reuse only where it materially speeds repeated capture passes

Completed closeout work:

1. the built-Arcade repo visual capture path now reuses unchanged game dist artifacts, not only the cached `@air-jam/sdk` build
2. repeated `pnpm run repo -- visual capture --game pong --mode arcade-built --scenario lobby` now logs `Reusing cached pong build.` on the second run
3. the remaining issue exposed by that rerun is a Pong Arcade-built scenario timeout waiting for `pong-controller-join-team-team1`, which now belongs to the Stage 2 fix pass

Done when:

1. the harness is being used as a real cleanup tool instead of remaining a plan artifact
2. remaining harness work is clearly post-release enhancement, not prerelease cleanup

### Workstream D. Docs And Scaffold Cleanup

1. align docs and generated scaffold guidance with the final audited SDK surface
2. remove archived-plan references from active docs
3. keep template guidance honest about what is built, what is optional, and what is cut

Done when:

1. active docs match the current implementation truth
2. archived plans no longer drive the repo narrative

## Validation Contract

Use targeted validation only for the surfaces actually touched:

1. relevant `@air-jam/sdk` build, test, and typecheck paths
2. relevant game or scaffold package validation if SDK-facing code changes
3. relevant visual-capture reruns if harness or UI cleanup changes
4. relevant platform build/test paths if runtime-owned settings behavior changes

## Exit Criteria

This plan is complete when:

1. the real prerelease implementation surface is reduced to truthful active work
2. the leftover SDK cleanup decisions are resolved one way or the other
3. the remaining harness work is either done or clearly post-release
4. the final manual prerelease plan becomes the only home for release-proof runbooks

Current read:

1. exit criteria `1`, `2`, and `4` are satisfied
2. exit criterion `3` was intentionally moved into the later polish stage instead of staying as fake-active implementation work
