# Composition Shell Contract Plan

Last updated: 2026-04-08  
Status: active

Related docs:

1. [Showcase Games Release Readiness Plan](./showcase-games-release-readiness-plan.md)
2. [Showcase Games Release Readiness Checklist](./showcase-games-release-readiness-checklist.md)
3. [SDK Extraction Clean-Swap Plan](./sdk-extraction-clean-swap-plan.md)
4. [Framework Paradigm](../framework-paradigm.md)
5. [Work Ledger](../work-ledger.md)
6. [AI-Native Development Workflow](../systems/ai-native-development-workflow.md)
7. [Template Docs Index](../../packages/create-airjam/template-assets/base/docs/docs-index.md)
8. [Template Skills Index](../../packages/create-airjam/template-assets/base/skills/index.md)

## Purpose

Define one composition-first UI/runtime contract so all launch-set games share the same baseline host lobby shell and controller shell behavior while preserving full game-specific theming and layout creativity.

This plan is intentionally separate from SDK extraction.
It is a game-kit style composition contract, not SDK-core runtime extraction.

## Current Gap Assessment

Current repo state is code-complete for the shared shell contract phase, with manual Arcade validation and checklist evidence still pending.

What landed:

1. small shared SDK UI atoms now exist for status, lifecycle actions, join URL controls, and shell headers
2. headless shell hooks now exist for host lobby state, controller status, lifecycle permissions, lifecycle intents, and lifecycle action modeling
3. all five launch-set games now consume the shared host/controller shell contract without keeping dual legacy controller shell paths
4. dedicated SDK tests now exist for shared shell hooks and atoms
5. global docs plus create-airjam template docs/skills now teach the contract and the full-custom escape hatch
6. package-level typecheck/test/build validation was run for the touched SDK and game packages

What is still missing before this plan can be considered executed:

1. readiness/checklist/manual Arcade evidence has not been updated for shell-contract completion
2. per-game checklist rows for the shell contract must be marked from real phone/controller sessions

Execution rule from this point:

1. do not mark this track complete based on atom adoption alone
2. keep shared behavior, validation, and docs aligned in the same pass
3. do not mark the plan complete until manual Arcade verification is recorded

## Decision Summary

1. Use composition-first primitives and hooks, not mandatory prebuilt mega components.
2. Keep SDK core runtime minimal and unchanged.
3. Provide headless hooks plus small reusable UI atoms in `@air-jam/sdk/ui`.
4. Keep full opt-out freedom:
   1. use as-is
   2. compose partially
   3. replace entirely with custom game UI
5. Make scaffold defaults production-usable so games function out of the box.

## Clean Purge Rule

This track is a clean swap, not a compatibility migration.

Rules:

1. no legacy wrappers
2. no deprecated aliases
3. no dual old/new codepaths kept for convenience
4. no "temporary" compatibility shims that survive merge
5. if required for correctness and maintainability, refactor surrounding code in the same track

Refactor policy:

1. prefer structural cleanup over incremental patching
2. remove superseded abstractions immediately once replacements are in
3. keep final architecture minimal, explicit, and easy to teach

## Product Contract To Unify

## Host Lobby Shell Contract

All launch-set games should expose the same host-lobby functional blocks:

1. room/join context
2. QR code
3. controller join URL input
4. copy URL action
5. open URL action
6. primary host start/play action

Visual style remains game-owned.
Placement contract stays structurally consistent even when themed.

## Controller Shell Contract

All launch-set games should expose the same controller shell structure and behavior:

1. top status bar with:
   1. connected status
   2. player avatar/identity
2. lifecycle action cluster in consistent position:
   1. start
   2. pause/resume
   3. back to lobby
3. gameplay controls below the shell

Theme, colors, typography, and decorative layout remain game-owned.
Action slot positions remain consistent.

Controller layout parity is explicit:

1. top bar, lifecycle action cluster, and gameplay-control regions keep the same structural positions across games
2. lifecycle action ordering stays consistent (`Start`, `Pause/Resume`, `Back to Lobby`)
3. touch-target baseline and spacing baseline are consistent across games

## Authority And Security Contract

1. controller surfaces emit intents only
2. host/store actions remain authoritative for lifecycle transitions
3. runtime capability checks remain enforced on privileged lifecycle channels
4. no direct controller-driven state mutation bypassing host authority

## Scope

In scope:

1. headless host/controller shell hooks in SDK UI layer
2. reusable tiny atoms where useful (`RoomQrCode`, URL actions, status chips)
3. reference compositions in scaffold/template assets
4. migration of launch-set games to the shared shell contract
5. test coverage for lifecycle and shell behavior consistency
6. removal of superseded shell patterns in games and scaffold sources during migration

Out of scope:

1. extracting game-domain rules into SDK core
2. forcing one visual style across games
3. removing ability to build without SDK UI
4. controller-authoritative lifecycle transitions
5. preserving obsolete shell APIs purely for backwards compatibility

## API Direction (Composition-First)

Target shape (illustrative; final names locked in implementation phase):

1. `useHostLobbyShell`
   1. room/join state
   2. copy/open handlers
   3. start action enablement data
2. `useControllerShellStatus`
   1. connection status
   2. identity/avatar metadata
3. `useControllerLifecycleIntents`
   1. start
   2. pause/resume
   3. back-to-lobby intent handlers
4. `useControllerLifecyclePermissions`
   1. exposes policy gates and reason flags for disabled actions

Small composable atoms can remain in `@air-jam/sdk/ui`:

1. `RoomQrCode`
2. `JoinUrlField` (or equivalent input atom)
3. `JoinUrlActions` (copy/open pair)
4. `ControllerStatusPill`
5. `LifecycleActionGroup`

No atom should hide lifecycle policy or authority decisions.
Those live in hooks and host-side actions.

## Default Policy Assumptions (Current)

These defaults are used unless changed during implementation:

1. all connected controllers can emit lifecycle intents
2. host/store remains final authority for applying transitions
3. shell layout contract means same slot structure and action positions, not pixel-identical CSS across games
4. host shell baseline requires slot parity; controller shell baseline requires layout parity
5. lifecycle intents are open to all connected controllers by default (no captain role model)
6. lifecycle intents should include anti-spam safeguards (host-side cooldown/throttle and optional confirmation for destructive transitions such as `Back to Lobby`)

## Documentation And LLM Authoring Contract

This track must ship with explicit teaching material for both humans and coding agents.

Required teaching paths:

1. composition-contract path:
   1. use SDK headless hooks and shell atoms
   2. keep slot/layout parity contracts
2. full-creative path:
   1. bypass premade atoms and build custom shell markup
   2. still honor lifecycle authority, intent flow, and required host/controller behaviors

Required doc surfaces to update in the same track:

1. global docs (`docs/`) for architecture and release contracts
2. `create-airjam` template docs (`packages/create-airjam/template-assets/base/docs/`)
3. `create-airjam` template skills (`packages/create-airjam/template-assets/base/skills/`)

Authoring rule:

1. every shell-related guide must explicitly state:
   1. what is required behavior contract
   2. what is optional scaffold/default UI
   3. how to replace defaults safely without losing lifecycle correctness

## Execution Workstreams

### Workstream A. Contract And API Lock

1. lock final hook/atom names and return shapes
2. lock lifecycle intent payload schema
3. define one canonical shell slot map for host and controller

Done when:

1. API names and slot map are documented
2. no unresolved naming/policy ambiguity remains

### Workstream B. SDK UI Headless Hooks

1. implement host/controller shell hooks
2. enforce intent-only controller path
3. keep hooks framework-owned and game-domain-agnostic
4. move lifecycle permission/enabled-state derivation out of per-game ad hoc header wiring where the shared contract can own it cleanly

Done when:

1. hooks compile in SDK
2. lifecycle intent tests pass
3. per-game integrations are consuming shared hook outputs rather than hand-rolling equivalent policy logic everywhere

### Workstream C. Reference Compositions

1. add canonical composed host lobby shell in scaffold/template assets
2. add canonical composed controller shell in scaffold/template assets
3. keep styling tokenized and easy to override
4. document which parts are required behavior contract vs optional default composition

Done when:

1. generated games boot with complete lobby/controller baseline out of the box
2. compositions can be replaced without changing runtime contracts
3. reference compositions are actually present in scaffold/template assets, not only repo-owned game code

### Workstream D. Launch-Set Migration

Migrate:

1. `games/pong` (baseline verification)
2. `games/air-capture` (baseline verification)
3. `games/code-review`
4. `games/last-band-standing`
5. `games/the-office`

Done when:

1. all five satisfy unified shell contract
2. game theming remains intact
3. superseded shell paths are removed (no dual-path legacy carryover)
4. `air-capture` controller no longer ships the pre-contract lifecycle/header path beside the shared shell route

### Workstream E. Validation And Release Gating

1. update readiness checklist evidence for unified shell rows
2. run per-game typecheck/test/build
3. run local Arcade manual validation for controller-first lifecycle controls
4. add dedicated shared-shell tests for the new SDK atoms and lifecycle behavior contract
5. add at least one authority/permission integration test covering rejected or disabled lifecycle paths

### Workstream F. Documentation And Skills Rollout

1. update global docs with shell contract and composition-vs-custom guidance
2. update `create-airjam` template docs to teach both composition and full-creative paths
3. update template skills so agents know:
   1. when to use shell hooks/atoms
   2. when and how to build fully custom UI without premade components
4. keep generated docs and skill references aligned with the final contract

Done when:

1. global and template docs both document required behavior contracts
2. skills explicitly teach safe full-custom replacement path
3. no guide implies premade components are mandatory
4. `create-airjam` template assets and skills are updated in the same pass, not left as a follow-up

## Validation Matrix

Per game:

1. host lobby always exposes QR + URL field + copy + open + start button
2. controller always exposes status + avatar + lifecycle actions in canonical slot layout
3. lifecycle actions function from controller without touching host surface
4. host authority remains intact (intent rejected paths covered)
5. ended flow and score/result screen contract remains intact

Automated:

1. targeted hook unit tests for shell state/permissions
2. lifecycle intent/authority integration tests
3. scaffold snapshot parity checks
4. doc parity checks for scaffold generated docs/skills where applicable
5. direct tests for shared UI atoms where they encode shared behavior or lifecycle visibility rules

Manual:

1. phone controller session per game in Arcade mode
2. verify action positions and shell behavior consistency across games
3. verify no game still exposes duplicate lifecycle controls after shell migration

## Done Criteria

This plan is complete when:

1. composition-first shell hooks/atoms are in place
2. all five launch-set games use the unified shell contract
3. controller can fully run lifecycle actions across games
4. launch checklist records pass for shell consistency and ended flow
5. no forced visual homogenization was introduced
6. global docs and template docs/skills both teach composition-first and full-creative implementation paths
7. no legacy/deprecation shell layer remains in repo-owned games, scaffolds, or docs
8. no launch-set game keeps both a shared-shell path and an older lifecycle shell path in parallel
