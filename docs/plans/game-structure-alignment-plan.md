# Game Structure Alignment Plan

Last updated: 2026-04-27  
Status: completed

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [V1 Release Launch Plan](./v1-release-launch-plan.md)
3. [Final Release Checks Plan](./final-release-checks-plan.md)
4. [Air Jam MCP And Agent Devtools Plan](./air-jam-mcp-and-agent-devtools-plan.md)
5. [SDK Game Authoring Ergonomics Plan](./sdk-game-authoring-ergonomics-plan.md)

## Purpose

Align the first-party games to one clean canonical Air Jam game shape before the final prerelease QA pass.

This is a structural refactor track, not a gameplay-feature track.

The goal is to remove older ownership patterns that still leak through some games so that:

1. the repo examples teach one coherent shape
2. template-owned source remains trustworthy
3. future game refactors and agent work do not have to reason across mixed generations of project structure
4. prerelease QA runs against the intended authoring model instead of a partially migrated launch set

## Canonical Baseline

Use `pong` as the structural baseline.

Reference files:

1. [games/pong/src/airjam.config.ts](/Users/timvucina/Desktop/MyProjects/air-jam/games/pong/src/airjam.config.ts)
2. [games/pong/src/app.tsx](/Users/timvucina/Desktop/MyProjects/air-jam/games/pong/src/app.tsx)
3. [games/pong/src/controller](/Users/timvucina/Desktop/MyProjects/air-jam/games/pong/src/controller)
4. [games/pong/src/host](/Users/timvucina/Desktop/MyProjects/air-jam/games/pong/src/host)
5. [games/pong/src/game](/Users/timvucina/Desktop/MyProjects/air-jam/games/pong/src/game)

Canonical ownership rules:

1. keep top-level `src/` thin:
   1. `airjam.config.ts`
   2. `app.tsx`
   3. `main.tsx`
   4. `index.css`
   5. `vite-env.d.ts`
2. host-only code lives under `src/host/*`
3. controller-only code lives under `src/controller/*`
4. gameplay-owned logic lives under `src/game/*`
5. shared game visuals/components that are not host shell or controller shell concerns live under `src/game/ui/*`
6. game-owned contracts live under `src/game/contracts/*`
7. tests should mirror the structure under `tests/` instead of being left in arbitrary `src/` roots unless there is a very narrow reason
8. root-level `src/components`, `src/hooks`, `src/lib`, and standalone gameplay files should be treated as migration smell unless they are truly app-shell entry concerns

Important nuance:

1. this plan does not require every game to have the same number of subfolders as `pong`
2. richer games such as `air-capture` can keep extra `src/game/*` subsystems where the complexity is real
3. the point is ownership clarity, not cosmetic folder uniformity

## Current Drift

### The Office

Status: major structural outlier

Relevant files:

1. [games/the-office/src/game-constants.ts](/Users/timvucina/Desktop/MyProjects/air-jam/games/the-office/src/game-constants.ts)
2. [games/the-office/src/task-manager.ts](/Users/timvucina/Desktop/MyProjects/air-jam/games/the-office/src/task-manager.ts)
3. [games/the-office/src/players.ts](/Users/timvucina/Desktop/MyProjects/air-jam/games/the-office/src/players.ts)
4. [games/the-office/src/components](/Users/timvucina/Desktop/MyProjects/air-jam/games/the-office/src/components)
5. [games/the-office/src/hooks](/Users/timvucina/Desktop/MyProjects/air-jam/games/the-office/src/hooks)
6. [games/the-office/src/lib](/Users/timvucina/Desktop/MyProjects/air-jam/games/the-office/src/lib)

Current issues:

1. gameplay/domain files still sit at `src/` root
2. host-facing UI is still rooted in `src/components` instead of `src/host/components`
3. generic hooks/helpers are not cleanly owned by `host`, `controller`, or `game`
4. there is no `src/game/contracts/*` structure
5. there is no semantic `src/game/contracts/agent.ts`
6. tests are still mixed into `src/` instead of being mirrored under `tests/`

### Code Review

Status: mostly aligned, small contract gap

Relevant files:

1. [games/code-review/src/game](/Users/timvucina/Desktop/MyProjects/air-jam/games/code-review/src/game)
2. [games/code-review/src/host](/Users/timvucina/Desktop/MyProjects/air-jam/games/code-review/src/host)
3. [games/code-review/src/controller](/Users/timvucina/Desktop/MyProjects/air-jam/games/code-review/src/controller)

Current issues:

1. semantic `src/game/contracts/agent.ts` is still missing
2. config does not yet publish a machine-owned agent contract

### Last Band Standing

Status: mostly aligned, one explicit dev-surface cleanup needed

Relevant files:

1. [games/last-band-standing/src/routes/youtube-test-page.tsx](/Users/timvucina/Desktop/MyProjects/air-jam/games/last-band-standing/src/routes/youtube-test-page.tsx)
2. [games/last-band-standing/src/app.tsx](/Users/timvucina/Desktop/MyProjects/air-jam/games/last-band-standing/src/app.tsx)

Current issues:

1. the YouTube test route is a dev/test seam living in the shipped app tree
2. it should be removed or relocated instead of remaining as an ambiguous route-level escape hatch

### Air Capture

Status: structurally richer but still carrying a few older seams

Relevant files:

1. [games/air-capture/src/components](/Users/timvucina/Desktop/MyProjects/air-jam/games/air-capture/src/components)
2. [games/air-capture/src/lib](/Users/timvucina/Desktop/MyProjects/air-jam/games/air-capture/src/lib)
3. [games/air-capture/src/prefab-preview](/Users/timvucina/Desktop/MyProjects/air-jam/games/air-capture/src/prefab-preview)

Current issues:

1. some root-level ownership still looks older than the canonical shape
2. `prefab-preview` is an explicit dev surface and should stay clearly marked as such
3. the goal is not to flatten Air Capture, but to narrow leftover seams and move obvious root-level drift under the right owner

## Workstreams

### Workstream 1. The Office Full Structure Alignment

This is the primary refactor in this plan.

Required outcomes:

1. move gameplay-owned root files into `src/game/*`
2. move host-facing UI from `src/components/*` into `src/host/components/*` where appropriate
3. move host-only hooks into `src/host/hooks/*`
4. move genuinely shared gameplay helpers into `src/game/*` instead of leaving them at `src/`
5. reduce or remove root `src/lib` unless a helper is truly app-shell-owned
6. create a clean `src/game/contracts/*` structure
7. add `src/game/contracts/agent.ts`
8. publish that contract from [games/the-office/src/airjam.config.ts](/Users/timvucina/Desktop/MyProjects/air-jam/games/the-office/src/airjam.config.ts)
9. move misplaced tests out of `src/` and into `tests/` where practical

Specific audit checklist while refactoring:

1. decide ownership for `task-manager.ts`
2. decide ownership for `players.ts`
3. decide ownership for `game-constants.ts`
4. decide whether any `src/components/ui/*` should remain shared shell UI or move into `src/game/ui/*`
5. confirm no import cycles or broad alias churn get introduced
6. keep behavior changes out unless needed to preserve correctness during the move

### Workstream 2. Code Review Semantic Agent Contract

Required outcomes:

1. add [games/code-review/src/game/contracts/agent.ts](/Users/timvucina/Desktop/MyProjects/air-jam/games/code-review/src/game/contracts/agent.ts)
2. wire it into [games/code-review/src/airjam.config.ts](/Users/timvucina/Desktop/MyProjects/air-jam/games/code-review/src/airjam.config.ts)
3. keep the contract semantic and game-owned rather than transport-shaped
4. add the smallest focused tests needed if the contract logic is nontrivial

### Workstream 3. Last Band Standing Dev Route Cleanup

Required outcomes:

1. remove [games/last-band-standing/src/routes/youtube-test-page.tsx](/Users/timvucina/Desktop/MyProjects/air-jam/games/last-band-standing/src/routes/youtube-test-page.tsx)
2. remove any route wiring or imports that keep that page in the app tree
3. confirm there is no remaining production-facing route dependency on that page
4. keep any truly useful YouTube debugging path only if it can be relocated into a clearly dev-only ownership pattern; otherwise delete it

### Workstream 4. Air Capture Alignment Pass

This is a bounded cleanup pass, not a full structural rewrite.

Required outcomes:

1. inspect root-level `src/components`, `src/lib`, and similar leftovers
2. move obviously mis-owned code under `src/host/*`, `src/controller/*`, or `src/game/*`
3. keep `src/prefab-preview/*` explicit as a dev-only surface
4. remove or tighten any ambiguous leftover seams that are no longer justified

Audit checklist:

1. identify which root `src/components/*` files are really host UI or game UI
2. identify which `src/lib/*` helpers are truly app-shell-owned versus game-owned
3. confirm `prefab-preview` remains intentionally isolated and not coupled back into the shipped host path
4. do not flatten legitimate game complexity just to mimic Pong cosmetically

### Workstream 5. Cross-Game Alignment Check

After the per-game work lands:

1. verify the first-party games follow one coherent ownership story
2. verify machine contracts are explicit where intended
3. verify template-owned source is still the canonical teaching surface
4. record any intentionally accepted differences so they do not look like accidental drift later

## Non-Goals

This plan does not try to:

1. make every first-party game folder tree identical
2. reopen broad gameplay polish work
3. redesign shared SDK architecture
4. force Air Capture into a simpler shape than its actual domain needs
5. add new launch features unrelated to structure alignment

## Suggested Execution Order

1. refactor The Office fully first
2. add the Code Review semantic agent contract
3. remove the Last Band Standing YouTube test route
4. run the Air Capture alignment pass
5. run one final cross-game alignment review
6. then move into the final prerelease QA plan

## Verification

At minimum, run:

1. per touched game:
   1. `typecheck`
   2. `test`
   3. `build`
2. focused MCP/game-agent inspection where agent contracts are added
3. one local browser-use smoke per game if the refactor touches host/controller wiring

Recommended final confidence pass after the whole plan:

1. re-run the affected launch-set game checks
2. confirm no template/scaffold assumption was broken by the structural moves
3. update docs if the canonical structure description needs to be made explicit elsewhere

## Done Criteria

This plan is complete when:

1. The Office follows the canonical ownership model cleanly
2. Code Review has a semantic agent contract published from config
3. Last Band Standing no longer ships the YouTube test route in its app tree
4. Air Capture no longer carries obvious unjustified root-level structural drift
5. the first-party launch games no longer teach mixed generations of Air Jam structure
6. execution can move into prerelease QA without this structural inconsistency still being an open known issue

## Current Truth

1. `the-office` now follows the canonical ownership model cleanly:
   1. top-level `src/` is thin again
   2. gameplay-owned files now live under `src/game/*`
   3. host-owned UI and hooks now live under `src/host/*`
   4. semantic `src/game/contracts/agent.ts` is in place and published from config
   5. the misplaced tests moved out of `src/` and into `tests/`
2. `code-review` now has a semantic `src/game/contracts/agent.ts` and publishes it from config
3. `last-band-standing` no longer carries the `/youtube-test` dev route in the shipped app tree
4. `air-capture` now keeps its debug-only UI kit under `src/game/debug/ui/*`, and its input schema now lives under `src/game/contracts/input.ts` instead of the older root `src/game/types.ts` pattern
5. the first-party games are materially closer to one coherent Air Jam authoring model, so prerelease QA no longer has to run against mixed structural generations
