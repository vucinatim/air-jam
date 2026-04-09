# Prerelease Systems Closeout Plan

Last updated: 2026-04-09  
Status: active

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [V1 Release Launch Plan](./v1-release-launch-plan.md)
3. [Final Prerelease Manual Check Plan](./final-prerelease-manual-check-plan.md)
4. [Controller Preview Dock Plan](./controller-preview-dock-plan.md)
5. [Suggestions](../suggestions.md)
6. [SDK Extraction Clean-Swap Plan (Archived)](../archive/sdk-extraction-clean-swap-plan-2026-04-09.md)
7. [Visual Review Harness Plan (Archived)](../archive/visual-review-harness-plan-2026-04-09.md)
8. [Composition Shell Contract Plan (Archived)](../archive/composition-shell-contract-plan-2026-04-09.md)

## Purpose

Capture only the prerelease implementation work that is still genuinely open after auditing the partially completed system plans.

This plan exists to replace stale active plans whose main implementation already landed, but which still made the active surface look larger and fuzzier than reality.

## Audit Outcome

The following tracks are now archived because the implementation is effectively complete, superseded, or only had manual verification left:

1. standard lifecycle contract
2. composition shell rollout
3. showcase-game implementation pass
4. public-release security baseline
5. visual harness base system and launch-set lifecycle coverage
6. the broad original SDK extraction plan

The real remaining prerelease implementation surface is narrower:

1. finish the last meaningful SDK cleanup decisions and purge stale plan promises
2. finish the visual-harness closeout work that still improves iteration or product quality
3. keep everything else out of this plan if it is really release proof, operations, or manual QA

## In Scope

### 1. SDK Surface Cleanup

Only keep the pieces that are still truly unfinished:

1. decide whether `PlatformSettingsRuntime` auto-mounting is still a prerelease goal
2. if yes, implement the canonical runtime-owned path cleanly
3. if no, remove that claim from the prerelease surface and docs
4. remove or tighten any remaining join-url fallback rebuilding that keeps the contract ambiguous
5. extract one shared controller connection-notice primitive only if it still clearly reduces repo/scaffold duplication
6. remove stale or duplicate repo/scaffold glue once the final direction is locked

### 2. Visual Harness Closeout

The harness itself is already real. The remaining work is:

1. use the existing launch-set coverage for targeted UI cleanup where artifacts expose real issues
2. extend build/prebuild reuse beyond `@air-jam/sdk` only where it materially improves repeated capture iteration
3. keep new scenario additions narrow and justified by real product cleanup needs

### 3. Docs And Scaffold Alignment

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

1. confirm the final list of real SDK leftovers
2. explicitly cut any extraction goals that are no longer worth doing prerelease
3. rewrite docs so the active plan surface matches the audit

Done when:

1. there is no stale active plan left for already-landed work
2. the remaining SDK closeout list is explicit and small

### Workstream B. SDK Cleanup

1. resolve the platform-settings ownership decision
2. resolve the join-url fallback ambiguity
3. extract or intentionally reject the shared connection-notice primitive
4. remove superseded repo/scaffold glue if the replacement is clear

Done when:

1. the SDK and scaffold surface teach one honest canonical path
2. no ambiguous prerelease extraction item remains in planning limbo

### Workstream C. Harness-Powered UI Cleanup

1. run the existing harness against the launch set when polishing host/controller surfaces
2. fix the highest-value responsiveness or shell-quality issues surfaced by captures
3. improve build reuse only where it materially speeds repeated capture passes

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

