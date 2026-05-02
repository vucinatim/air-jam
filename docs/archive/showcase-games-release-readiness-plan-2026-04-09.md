# Showcase Games Release Readiness Plan

Last updated: 2026-04-07  
Status: archived

Archived on: 2026-04-09  
Archive reason: the implementation pass is complete enough to archive; final manual proof moved to [Final Prerelease Manual Check Plan](../plans/final-prerelease-manual-check-plan.md)

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [V1 Release Launch Plan](../plans/v1-release-launch-plan.md)
3. [Showcase Games Release Readiness Checklist (Archived)](./showcase-games-release-readiness-checklist-2026-04-09.md)
4. [ZeroDays Game Import And Template Promotion Plan](../archive/zerodays-game-import-template-promotion-plan-2026-04-07.md)
5. [Framework Paradigm](../framework-paradigm.md)
6. [Legacy Game Migration Guide](../systems/legacy-game-migration-guide.md)
7. [Environment Contracts](../systems/env-contracts.md)

## Purpose

Define one concrete quality baseline for release-ready showcase games so launch decisions are not subjective.

This plan is the execution contract for gameplay and UX alignment across:

1. `games/code-review`
2. `games/last-band-standing`
3. `games/the-office`
4. release validation re-check on `games/pong`
5. release validation re-check on `games/air-capture`

## Core Product Position

These are real Air Jam games, not tech demos.

For release they must be:

1. controllable end-to-end from phone controllers
2. clear in lobby-to-match-to-ended-to-reset flow
3. stable in Arcade and standalone runtime stories
4. visually aligned with each game's existing theme

Do not restyle games into a uniform look.
Keep each game's original visual identity and improve usability inside that identity.

## Non-Goals

1. no full art-direction rewrite
2. no forced convergence to one UI style
3. no framework purity refactor that does not improve release quality
4. no reopening settled SDK/server architecture tracks

## Release Baseline Contract

Every launch game must pass these gates.

### 1. Controller-Complete Control Contract

1. all core actions are reachable on controller without keyboard/mouse
2. join, ready, start, play, and post-round actions are reachable from controller
3. touch targets are large and reliable on mobile
4. no gameplay-critical scroll dependence on controller

### 2. Lobby, Match, And Ended Flow Contract

1. explicit lobby state exists before gameplay starts
2. players can set identity or role where relevant
3. readiness is explicit and visible
4. match start is deterministic and host-authoritative
5. explicit ended/game-over phase exists after gameplay completes
6. ended/game-over host screen shows a basic score/result summary
7. post-match reset path is clear and repeatable

### 3. Host Authority And State Contract

1. networked state mutations are action-driven
2. host-only actions enforce role checks
3. controller actions use actor identity safely
4. no implicit side effects that start/advance matches without an explicit transition

### 4. UX And Responsive Contract

1. host and controller surfaces remain usable on common phone sizes and couch host displays
2. no overflow clipping that hides critical controls or information
3. no brittle CSS hacks that rely on deep runtime DOM selectors
4. fullscreen behavior must be user-gesture-driven and explicit

### 5. Reliability And Content Contract

1. media dependencies are validated before release packaging
2. broken remote embeds do not silently degrade the round flow
3. release builds exclude debug-only routes/surfaces from normal user flows

### 6. Validation Contract

1. manual Arcade runbook pass per game
2. game-specific automated checks where practical
3. root quality gates remain green: typecheck, lint, test, build

## Shared Execution Workstreams

### Workstream A. Flow And Authority Alignment

1. define one shared lobby/ready/start/ended policy for showcase games
2. enforce host-only start/reset/advance actions in stores
3. normalize controller responsibilities to input, ready state, and gameplay actions

### Workstream B. Controller UX Hardening

1. remove accidental desktop-like control patterns
2. keep action-first controller layouts
3. remove friction in lobby and reconnect paths

### Workstream C. Host Surface Hardening

1. keep gameplay viewport primary
2. keep overlays secondary, modular, and responsive
3. remove sizing guesses that break at common display ratios

### Workstream D. Runtime Hygiene

1. remove brittle runtime chrome CSS hacks
2. gate fullscreen prompting correctly
3. keep debug routes behind explicit debug intent

### Workstream E. Media And Content Validation

1. add a song/embed validation script for `last-band-standing`
2. produce machine-readable report output for fast curation
3. document the curation flow so invalid songs can be removed quickly

## Game-Specific Plan

## `code-review`

### Required Outcomes

1. add bot players so matches remain meaningful with low player counts
2. keep team fantasy and retro look, but make lobby/start/readiness clearer
3. eliminate brittle controller fullscreen forcing and runtime DOM CSS hacks
4. split host surface logic into clearer modules where change risk is highest
5. add explicit ended phase with basic score summary screen before reset

### Implementation Notes

1. bots should fill missing seats per team with deterministic host-side behavior
2. bot behavior should be intentionally simple and legible, not "AI-heavy"
3. bot presence and count should be visible in host UI
4. host remains the only authority for match state transitions

### Acceptance Criteria

1. game can run with 1 human vs bots and still feel playable
2. team assignment and start flow are explicit and reliable
3. controller does not rely on forced fullscreen calls across gameplay buttons
4. no deep-selector CSS used to hide runtime platform chrome
5. ended state shows winner/score summary and exposes clear reset path

## `last-band-standing`

### Required Outcomes

1. enforce host-authoritative start/reset flow
2. keep controller lobby focused on name + ready + gameplay answers
3. add repeatable YouTube embed validation tooling
4. remove legacy architecture leftovers that add confusion
5. keep explicit ended/game-over phase with clear score/rank summary screen

### Implementation Notes

1. controller should not directly start matches
2. host lobby must present clear start controls once readiness conditions are met
3. keep the existing music-game visual style, improve clarity and responsiveness
4. remove or guard `/youtube-test` from production player flow
5. consolidate store imports to one canonical boundary (`src/game/stores`)

### Acceptance Criteria

1. only host role can transition lobby -> round-active and reset lobby
2. lobby flow is clear with multiple players on phones
3. script outputs pass/fail for each song URL and supports quick pruning
4. game still feels like the same theme, without layout overflow regressions

## `the-office`

### Required Outcomes

1. introduce a real lobby and start flow suitable for Arcade play
2. add a character picker with character image + displayed stats before match start
3. fix timing/state correctness issues in game loop and task system
4. preserve office-themed style while improving controller and host usability
5. add explicit ended phase with basic score/earnings summary before reset

### Character Picker Contract

1. controller can browse available characters
2. each character card shows image, name, and relevant stats
3. selected character is locked into shared state and visible on host
4. ready state requires valid character selection
5. host sees player -> character mapping before start

### Implementation Notes

1. unify time source usage in loop and task expiry logic
2. game timer should start on explicit match start, not on empty host render
3. avoid fixed-size controller controls that overflow smaller screens

### Acceptance Criteria

1. players can join, pick character, ready up, and start cleanly
2. character stats are visible and understandable before gameplay
3. timer/task behavior is consistent and deterministic in normal play
4. host and controller layouts remain usable across target screen sizes
5. ended state shows clear final score/earnings summary and restart CTA

## `pong` And `air-capture` Re-Validation

### Required Outcomes

1. rerun the full readiness checklist to confirm no regressions from shared runtime changes
2. keep both as reference-quality exemplars

### Acceptance Criteria

1. controller-complete flow still passes
2. lobby/start/reset flow still passes
3. no new responsive/runtime hygiene regressions

## Execution Phases

### Phase 0. Baseline Lock And Checklist Finalization

1. freeze this baseline contract
2. convert contract into a per-game QA checklist artifact

### Phase 1. Authority And Flow Fixes

1. fix host-only action ownership gaps
2. normalize lobby/ready/start transitions in all three showcase games

### Phase 2. Controller And Host UX Pass

1. mobile control ergonomics pass
2. host overlay/responsive pass
3. remove brittle hacks and debug leakage

### Phase 3. Feature Completion For Missing Core UX

1. `code-review` bots
2. `the-office` character picker with stats and images
3. `last-band-standing` media validation tooling

### Phase 4. Stabilization And Release Validation

1. per-game manual Arcade runbook pass
2. targeted automated checks and regression fixes
3. final root quality gates

## Phase Progress Snapshot (2026-04-07)

1. Phase 0 baseline contract: complete
2. Phase 1 authority and flow: materially complete for the three showcase games
3. Phase 2 controller/host UX pass: materially complete with targeted runtime-hygiene fixes
4. Phase 3 missing-core-UX features: complete
5. Phase 4 stabilization and final validation: in progress
   1. local Arcade boot smoke now passes for all five launch-set games (`pong`, `air-capture`, `code-review`, `last-band-standing`, `the-office`)
   2. fresh per-game validation passes are recorded for all five launch-set games (`typecheck`, `test`, `build`)
   3. browser smoke is currently green again (`pnpm smoke:browser`, `4/4`) after capability-aware controller join test alignment
   4. remaining gate is manual phone/controller gameplay runbook and final outcome records

Update (2026-04-07, late):

1. lifecycle alignment scope is extended with one explicit baseline across all launch-set games:
   1. explicit ended/game-over phase in domain flow
   2. basic host-visible score/result summary before reset
2. this baseline is tracked in this plan and checklist, not in SDK extraction scope

## Implemented In This Track

### `code-review`

1. deterministic host-side bots now fill missing fighter seats, preserving 4-slot match flow
2. host start flow now requires at least one assigned human and all assigned humans ready
3. host paused overlay now shows human ready state, bot counts, and explicit slot roster
4. controller fullscreen forcing was removed so gameplay no longer triggers forced fullscreen requests

### `last-band-standing`

1. `startMatch` and `resetLobby` are now host-authoritative at store action boundary
2. controller lobby no longer exposes start-match controls
3. host lobby now owns start-match CTA with ready-state gating
4. repeatable song/embed validation tooling exists via `pnpm songs:validate`
5. `/youtube-test` is now debug-gated through `import.meta.env.DEV` or `VITE_ENABLE_YOUTUBE_TEST_ROUTE=true`
6. the known non-embeddable songs were removed; validator now passes with 77/77 embeddable and zero duplicate IDs
7. default production builds now exclude the debug page chunk unless the debug route flag is explicitly enabled

### `the-office`

1. lobby now has controller character picker with image and capability highlights
2. picker enforces unique character ownership per controller
3. ready-up now requires a valid character selection
4. host lobby overlay now shows selected-character mapping, stats highlights, and ready/picked counts
5. match start is now explicit from host lobby and initializes game timer/task loop on start

### Scaffold Parity (`create-airjam`)

1. scaffold snapshots were regenerated from `games/` after these changes
2. the three showcase templates now carry the same lobby/authority/runtime-hygiene behavior as source games

## Evidence And Sign-Off

Each game gets one release-readiness record with:

1. baseline checklist result
2. notable fixes shipped
3. known limitations accepted for v1
4. final status: `ready` or `not-ready`

Release sign-off requires all five launch games marked `ready`.

## Done Criteria

This plan is complete when:

1. all baseline contract sections pass for each launch game
2. `code-review` includes bots in release-quality match flow
3. `the-office` includes character picker with image + stats in lobby flow
4. `last-band-standing` has a repeatable song/embed validation workflow
5. launch-set games feel coherent, controller-first, and publicly presentable without changing their core style identity
