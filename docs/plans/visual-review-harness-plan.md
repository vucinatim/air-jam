# Visual Review Harness Plan

Last updated: 2026-04-08  
Status: active

Related docs:

1. [Showcase Games Release Readiness Plan](./showcase-games-release-readiness-plan.md)
2. [Composition Shell Contract Plan](./composition-shell-contract-plan.md)
3. [Controller Preview Dock Plan](./controller-preview-dock-plan.md)
4. [Work Ledger](../work-ledger.md)
5. [Docs Index](../docs-index.md)

Prerequisite status:

1. the standard lifecycle contract reset is complete, so this plan is no longer blocked on lifecycle semantics

## Purpose

Build a reusable visual-review harness for Air Jam games so agents and humans can capture deterministic host/controller screenshots for specific game states and screen sizes, inspect the actual rendered UI, and iterate on fixes with a stable feedback loop.

Phase 1 is for this monorepo only.

The design should be reusable later for:

1. `create-airjam` standalone projects
2. future AI Studio orchestration

without changing the core artifact and scenario contract.

## Long-Term Vision

This system should become the canonical UI feedback loop across the Air Jam ecosystem.

The end-state vision is:

1. repo games can be visually inspected through deterministic host/controller scenarios
2. standalone `create-airjam` projects can use the same scenario and artifact contract locally
3. AI Studio agents can orchestrate the same capture flow remotely or locally without inventing a separate visual-debug pipeline
4. humans, CI, and agents all use the same underlying harness instead of three different systems

In the long run, this should feel like a first-class product capability:

1. define visual scenarios
2. run them in a stable environment
3. inspect artifacts
4. iterate on UI with confidence

That means Phase 1 should be intentionally narrow, but architected so it can grow without rewrites.

## Vision Principles

1. one core capture contract across repo, standalone projects, and future Studio
2. deterministic outputs over ad hoc browser sessions
3. scenario ownership stays with the game, not buried inside a central engine
4. artifact format stays machine-readable and human-usable
5. local usefulness comes first; remote and agent orchestration layer on later
6. stage the rollout so each phase is independently valuable

## Staged Evolution

### Phase 1. Repo-Owned Screenshot Harness

This plan covers Phase 1.

Goal:

1. one command
2. one game
3. one set of screenshots and metadata on disk
4. agent can inspect, patch, rerun

This solves the immediate repo UI-debug loop.

### Phase 2. Launch-Set Coverage And Better Scenarios

Once the first vertical slice is proven:

1. cover all launch-set games with baseline host/controller scenarios
2. add more scenario depth where useful (`ended`, `paused`, `bots-added`, `ready-state`, `error-state`)
3. add stronger scenario assertions before capture
4. add optional notes/report output for common layout risk detection

This makes the harness a dependable prerelease UI tool for this repo.

### Phase 3. Scaffold And Standalone Promotion

Once the contract is stable:

1. promote the shared scenario/artifact model into `create-airjam`
2. provide generated example scenario files in scaffolded projects
3. provide docs and skills that teach how to capture and inspect UI locally
4. keep the repo-specific runtime launch layer separate from the portable harness layer

This makes the system useful outside the monorepo.

### Phase 4. AI Studio Integration

Later, AI Studio should be able to orchestrate the same harness contract.

That means:

1. Studio can request named scenarios for a project
2. the same metadata and artifact structure is returned
3. agents can reason over the screenshots and apply fixes
4. local and hosted workflows remain conceptually the same

Studio should consume this system, not replace it.

### Phase 5. Optional Higher-Level Capabilities

Only if real usage justifies them:

1. visual diff support
2. golden screenshot baselines
3. scenario collections for release gates
4. richer layout diagnostics derived from DOM and screenshot metadata
5. remote artifact viewers or Studio-native inspection UIs

These are optional future layers, not the Phase 1 target.

## Problem

Current UI debugging is too manual and too conversational.

Typical failure stories are:

1. layout overflow on host or controller
2. broken spacing or sizing at specific viewports
3. shells that look fine in one state and scuffed in another
4. regressions introduced by unrelated game or SDK changes

The missing capability is:

1. run one command for one game
2. capture the key host/controller states
3. save stable screenshots and metadata to disk
4. let an agent inspect those files and fix the UI
5. rerun the same capture and compare

## Product Goal

This should make the following loop normal:

1. user says: `UI in code-review looks off`
2. agent runs the visual harness for `code-review`
3. harness captures host and controller screenshots for standard scenarios and viewports
4. agent reads the artifacts, identifies the layout problem, patches the code, reruns the harness, and validates the result

That is the baseline outcome for Phase 1.

## Decision Summary

1. build a repo-owned visual harness instead of relying on attached-browser-only workflows
2. reuse Playwright, the existing browser smoke stack, and workspace Arcade/runtime commands
3. keep the harness useful for humans, CI, and agents, not AI-only
4. use game-owned scenario files, not one giant central flow engine
5. write artifacts to a stable deterministic output path
6. clean outputs on rerun for the same game/scenario so artifacts do not grow forever
7. treat Phase 1 as screenshot-and-metadata capture, not visual diff infrastructure

## Why This Wins Over Attached-Browser-Only

Attached browser tools are still useful for live exploration, but they are not the primary architecture for this problem.

The harness wins long term because it gives:

1. repeatable scenarios
2. fixed viewport presets
3. stable artifact paths
4. reusable commands
5. the same contract for local dev, future standalone repos, and AI Studio

The attached browser remains a secondary debugging tool for one-off deep inspection.

## Phase 1 Scope

In scope:

1. run one command for one repo-owned game
2. boot the correct local runtime stack for that game
3. capture host and controller screenshots for named scenarios
4. support standard host/controller viewport presets
5. save metadata next to screenshots
6. clean and rewrite artifacts for rerun stability
7. make artifacts easy for an agent to locate and inspect
8. support at least the launch-set games

Out of scope:

1. pixel diff approval workflows
2. visual regression dashboards
3. AI scoring or automatic bug classification
4. autonomous multi-controller swarms
5. video-first review infrastructure
6. immediate standalone `create-airjam` packaging work
7. AI Studio integration in the first implementation

## Core Contract

## Command Contract

Phase 1 should expose one repo command surface, under the existing repo CLI.

Illustrative command shape:

1. `pnpm run repo -- visual capture --game=code-review`
2. `pnpm run repo -- visual capture --game=code-review --scenario=host-lobby`
3. `pnpm run repo -- visual capture --game=code-review --mode=arcade-built`

The exact flag names can be finalized during implementation, but the command must stay:

1. discoverable
2. scriptable
3. deterministic

## Artifact Contract

Artifacts should live under one stable repo-owned output root:

1. `.airjam/artifacts/visual/<game>/<scenario>/`

Each capture should write:

1. `metadata.json`
2. one or more screenshots such as:
   1. `host-desktop.png`
   2. `host-tablet.png`
   3. `controller-mobile.png`
   4. `controller-small-mobile.png`

The metadata file should include:

1. game id
2. scenario id
3. runtime mode
4. timestamp
5. viewport names and sizes
6. host/controller URLs used
7. capture success/failure per surface
8. optional notes emitted by the scenario runner

## Cleanup Contract

Reruns must not create infinite artifact sprawl.

Rules:

1. rerunning the same game/scenario replaces that scenario directory contents
2. no timestamped nested directories by default
3. optional retention modes can come later, but default behavior is clean overwrite
4. failures should still leave the most recent metadata and any partial screenshots behind for debugging

## Scenario Contract

Scenarios are game-owned and explicit.

Each scenario should declare:

1. scenario id
2. runtime mode
3. setup steps
4. required surfaces to capture
5. optional assertions before capture
6. optional teardown/cleanup notes

Phase 1 scenario families:

1. `host-lobby`
2. `controller-lobby`
3. `host-ready`
4. `playing`
5. `ended`

Not every game must support every scenario on day one, but the contract should make this easy to extend.

## Preset-First Checkpoint Model

The harness should work in this priority order:

1. standard preset checkpoints
2. optional game lifecycle adapter
3. full custom scenario code only when necessary

### Standard Preset Checkpoints

The default harness checkpoints should be:

1. `host-lobby`
2. `controller-lobby`
3. `playing`
4. `ended`

These should work out of the box for standard-lifecycle projects without any per-game state declarations.

### Optional Game Lifecycle Adapter

Games with richer internal lifecycle detail should be able to provide a small adapter that maps local lifecycle semantics onto the standard checkpoints.

That adapter should be the preferred extension point when a game only needs to map:

1. its local lifecycle field
2. local values corresponding to `lobby`
3. local values corresponding to `countdown`
4. local values corresponding to `playing`
5. local values corresponding to `ended`
6. unsupported checkpoints, if any

This keeps the harness generic while preserving room for unusual games.

### Full Custom Scenarios

Only unusual projects should need fully custom scenario flows.

This path remains valid for:

1. nonstandard Air Jam apps
2. highly custom game structures
3. projects whose UX cannot be represented cleanly through the standard checkpoint model

## Architecture

## 1. Shared Harness Runner

Create a repo-owned runner that is responsible for:

1. launching or reusing the right local stack
2. opening Playwright browser contexts
3. creating host/controller pages
4. applying standard viewport presets
5. delegating game-specific setup to scenario code
6. writing artifacts and metadata

This runner should not contain game-specific lobby logic.

## 2. Shared Runtime Utilities

Reuse existing seams where possible:

1. workspace Arcade commands and topology helpers
2. browser smoke stack patterns
3. controller join helpers in `tests/browser/helpers/`

If shared helpers need to be extracted from current smoke tests, do that rather than duplicating them.

## 3. Game-Owned Scenario Modules

Each repo game should own a small scenario file set.

Location can be finalized in implementation, but the shape should be something like:

1. `games/<id>/visual-scenarios/*.ts`

Each scenario module should be plain and explicit.

No DSL is required if simple TypeScript functions stay cleaner.

In addition, a game may optionally expose a small lifecycle adapter module.

That adapter should stay much smaller than a full custom scenario file and should be preferred whenever the only need is mapping richer local lifecycle values to the standard harness checkpoints.

## 4. Standard Viewport Presets

Phase 1 should ship a small fixed set:

Host:

1. `desktop`
2. `tablet`

Controller:

1. `mobile`
2. `small-mobile`

The goal is to surface the common layout failures, not to model every device class.

## Phase 1 Implementation Plan

### Workstream A. Command And Artifact Foundation

1. add a repo CLI `visual` command group
2. add a `capture` command for one game
3. implement artifact directory cleanup and metadata writing
4. define viewport presets and file naming

Done when:

1. one command can create a clean artifact folder for one game
2. reruns overwrite the same artifact paths deterministically

### Workstream B. Shared Playwright Harness

1. extract or reuse common Playwright/browser-smoke helpers
2. add host/controller page boot utilities
3. add join-flow utilities for controller pages
4. add shared screenshot capture helpers

Done when:

1. the harness can drive host + controller for one game without inline duplicated flow code

### Workstream C. First Game Vertical Slice

Start with one game, preferably `code-review`, because it currently has obvious layout pressure and clear host/controller/lobby states.

Implement:

1. `host-lobby`
2. `controller-lobby`
3. `playing`
4. `ended`

Done when:

1. the agent can run one command for `code-review`
2. screenshots are produced in stable paths
3. artifacts are sufficient to diagnose common host/controller layout breakage

### Workstream D. Launch-Set Expansion

Expand to:

1. `pong`
2. `air-capture`
3. `last-band-standing`
4. `the-office`

Done when:

1. each launch-set game has at least baseline host/controller lobby coverage

### Workstream E. Agent Workflow Documentation

Document the intended workflow:

1. run the harness
2. inspect screenshots
3. patch UI
4. rerun and validate

This should be documented both for repo contributors and for future `create-airjam`/AI Studio reuse.

## Reuse Strategy

## Future `create-airjam` Reuse

Phase 1 should stay repo-only in implementation surface, but the architecture should avoid monorepo-only assumptions.

The reusable parts later should be:

1. scenario contract
2. viewport presets
3. metadata contract
4. screenshot artifact layout
5. standard-preset plus adapter model

The repo-only parts in Phase 1 can be:

1. workspace launch commands
2. local Arcade stack wiring

That split gives a clean later promotion path into scaffolded projects.

When Phase 3 starts, the preferred split should be:

1. portable visual harness core
2. repo adapter for this monorepo runtime/workspace model
3. scaffold adapter/template examples for standalone projects

## Future AI Studio Reuse

AI Studio should eventually orchestrate the same core harness contract rather than inventing a second visual-inspection system.

That means this plan should preserve:

1. deterministic scenario ids
2. stable artifact paths or stable artifact metadata shape
3. machine-readable capture output
4. clean separation between harness core and repo-specific launch adapters

The future system should support this flow:

1. Studio asks for `code-review` visual capture in a known scenario
2. the harness adapter runs the capture in the appropriate environment
3. screenshots and metadata are produced in the same canonical format
4. the agent reviews the output and proposes or applies fixes
5. Studio reruns the same scenario for validation

Studio should follow the same priority order:

1. standard presets first
2. lifecycle-adapter mapping second
3. full custom scenario orchestration only when necessary

## Risks

1. overbuilding a generic framework before proving one game vertical slice
2. mixing exploratory browser-debug concerns into the deterministic harness path
3. allowing artifact retention to become noisy and hard to reason about
4. encoding too much game logic into the shared runner instead of scenario modules
5. trying to solve gyro/audio/fullscreen realism in Phase 1

## Guardrails

1. start with screenshots, not video
2. start with one game, not all five at once
3. keep scenarios plain TypeScript instead of inventing a DSL too early
4. keep artifact output deterministic and clean by default
5. use the attached browser only as a complementary tool, not the primary system
6. do not bind the core contract too tightly to this repo’s current workspace launcher details
7. do not add CI gating or golden-baseline policy until the capture contract is proven useful in normal development
8. do not require manual game-defined state declarations for normal projects that already follow the standard lifecycle contract

## Acceptance Criteria

Phase 1 is successful when:

1. an agent can run one command for a specific game and get deterministic host/controller screenshots on disk
2. rerunning the same capture cleans and rewrites the same artifact paths
3. the captured screenshots are sufficient to diagnose common host/controller layout issues
4. the harness reuses existing repo browser/runtime seams rather than duplicating stack logic
5. the contract is clean enough to promote later into `create-airjam` and AI Studio
6. the implementation leaves a clear seam between portable capture logic and repo-specific runtime launch logic
7. standard-lifecycle projects work with presets alone and do not require per-game lifecycle declarations

## Recommended First Implementation Target

1. game: `code-review`
2. runtime mode: local Arcade built or browser-smoke-backed local mode
3. scenarios:
   1. `host-lobby`
   2. `controller-lobby`
   3. `playing`
4. viewports:
   1. host `desktop`
   2. controller `mobile`

That is enough to prove the loop before broadening the system.
