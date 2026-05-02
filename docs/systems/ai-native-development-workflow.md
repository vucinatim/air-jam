# Air Jam AI-Native Development Workflow

Last updated: 2026-03-28  
Status: active direction

Related docs:

1. [Framework Paradigm](../framework-paradigm.md)
2. [Documentation Architecture](./documentation-architecture.md)
3. [Monorepo Operating System](../monorepo-operating-system.md)
4. [AI Studio Architecture](./ai-studio-architecture.md)
5. [Docs Index](../docs-index.md)

## Purpose

This document defines the intended AI-native development model for Air Jam projects.

It exists to make one thing explicit:

Air Jam should become extremely friendly to vibe coding and AI-assisted creation, but only through strong project contracts and clear boundaries.

The goal is not to let agents improvise a whole codebase from loose prompts.

The goal is to give humans and agents one clean operating model that keeps projects:

1. simple
2. modular
3. testable
4. scalable
5. easy to reason about

## Core Position

Air Jam should not treat "AI-friendly" as:

1. vague repo instructions
2. hidden framework assumptions
3. giant prompt files
4. duplicated drifting docs
5. templates that devolve into random React code

The correct model is:

1. one canonical workflow
2. one small set of canonical operating files
3. one explicit docs access path
4. one skill layer for repeatable agent behavior
5. one clean default game architecture
6. strong guidance for UI, stores, engine boundaries, debugging, and tests

Constraint is the feature.

Air Jam should feel easy to build with because the system is opinionated, not because it is loose.

## Product Goal

An Air Jam project should feel like this:

1. open the repo
2. read one short contract
3. read one active plan
4. consult the smallest relevant docs slice
5. implement within known boundaries
6. update the same plan as work progresses
7. collect future improvements in one place
8. keep architecture clean as the game grows

That flow should work for:

1. human-only development
2. human + AI pair workflows
3. AI-led implementation with human review
4. future Studio-driven agent workflows

## The Correct Model

Air Jam should define five explicit layers for AI-native development:

1. repo operating rules
2. AI workflow rules
3. docs access rules
4. game architecture rules
5. implementation quality rules

These layers should stay separate so guidance stays clear and maintainable.

## 1. Repo Operating Rules

Every serious Air Jam project should converge on a small canonical operating set.

### Canonical Files

The intended minimal set is:

1. `AGENTS.md`
2. `plan.md`
3. `suggestions.md`
4. `docs/docs-index.md`
5. `docs/framework-paradigm.md`
6. `docs/development-loop.md`
7. `skills/`
8. `src/`
9. `tests/`

### File Ownership

#### `AGENTS.md`

This is the main human + AI repo contract.

It should define:

1. architecture values
2. workflow rules
3. code quality rules
4. UI rules
5. docs consultation triggers
6. escalation rules for refactors vs quick fixes

It should stay concise and authoritative.

#### `plan.md`

This is the single canonical active ledger for the project.

It should track:

1. current goal
2. active checklist
3. decisions made
4. progress log
5. blockers
6. next actions
7. recently completed work

It should not become a brainstorming dump.

It should always reflect the current state of work.

#### `suggestions.md`

This is the durable improvement backlog.

It should hold:

1. refactor ideas
2. architecture improvements
3. DX improvements
4. performance concerns
5. testing gaps
6. tool and workflow upgrades

It is not the active task ledger.

#### `skills/`

This is the local behavior layer for AI workflows.

Skills should teach the agent how to work in the repo.

They should not duplicate whole docs.

They should wrap docs, workflows, and repeatable decision rules.

## 2. AI Workflow Rules

Air Jam projects should define a default AI workflow explicitly instead of expecting the agent to invent one.

### Default Workflow

For any non-trivial task, the correct flow is:

1. read `AGENTS.md`
2. read `plan.md`
3. inspect relevant code structure
4. read only the relevant docs slice from `docs/`
5. decide whether the task fits the current architecture
6. propose refactor first if the current structure is wrong
7. implement the smallest correct change
8. update `plan.md`
9. add durable follow-ups to `suggestions.md`
10. run relevant validation
11. update docs in the same change when contracts or canonical patterns change

### Refactor Rule

Agents should not blindly implement a quick fix when the requested change would increase structural debt.

If the task clearly requires a more extensible boundary, the agent should say so directly and either:

1. do the refactor first
2. split the work into a refactor step and a feature step

This is especially important for:

1. state ownership
2. transport boundaries
3. rendering architecture
4. engine code
5. scene composition
6. controller UI composition

### Plan Update Rule

The agent should update `plan.md` whenever:

1. starting a meaningful new task
2. changing approach
3. completing a checklist item
4. discovering a blocker
5. making an architectural decision

The project should not rely on chat history as the primary source of progress truth.

## 3. Docs Access Rules

Air Jam should use a hybrid docs model for AI workflows.

Live hosted docs alone are not enough because they can drift from a local template version.

Local copied docs alone are not enough because they become stale and harder to search across.

The correct direction is:

1. a minimal local docs pack
2. a richer hosted docs source
3. a version-aware CLI bridge between them
4. skills that teach when each source should be consulted

### Local Docs

Templates should ship with the operational docs that matter during implementation.

The minimal local set should cover:

1. framework paradigm
2. development loop
3. game structure guide
4. controller UI guide
5. host UI guide
6. state and store guide
7. prefab guide
8. debug and logging guide
9. testing guide

These docs should stay concise and opinionated.

### Hosted Docs

The platform should host the richer canonical docs set for:

1. broader framework guidance
2. searchable public guides
3. updated patterns
4. future AI Studio retrieval
5. version-aware doc delivery

### Docs CLI

Air Jam should eventually provide a docs CLI that makes docs retrieval explicit and predictable.

The preferred shape is:

1. `airjam docs search <query>`
2. `airjam docs open <doc-id>`
3. `airjam docs sync`
4. `airjam docs status`

The CLI should support stable metadata such as:

1. doc id
2. title
3. summary
4. version
5. topic tags
6. source location
7. local freshness status

### Distribution Model

The intended distribution model is:

1. canonical public docs content authored in `content/docs/`
2. scaffold-only AI/dev assets authored in the `create-airjam` base pack
3. a packaged local snapshot copied into every new project
4. a hosted manifest and sync/update path added later

This means the default agent workflow should be:

1. use local files first
2. use hosted docs or hosted pack metadata only when the task needs newer canonical information or an explicit update flow

Air Jam should not rely on remote retrieval as the only path for agent usability in scaffolded projects.

### Docs Consultation Triggers

Agents should consult docs when:

1. creating a new gameplay system
2. changing host/controller boundaries
3. changing shared contracts
4. changing replicated state structure
5. building controller UI
6. building host shell or game shell layout
7. adding prefabs or content systems
8. adding or changing debug/logging flows
9. changing template or project structure
10. making decisions that affect maintainability or future extensibility

Agents should not read the whole docs tree by default.

They should read the smallest relevant slice.

## 4. Skills Model

Skills should be the behavior layer, not a second documentation tree.

Their job is to make recurring workflows repeatable.

Good Air Jam skill categories include:

1. `plan-management`
2. `airjam-docs-usage`
3. `game-architecture`
4. `controller-ui-rules`
5. `host-ui-rules`
6. `prefab-authoring`
7. `zustand-r3f-pitfalls`
8. `debug-logging-workflow`
9. `testing-strategy`

### Skill Design Rule

Each skill should answer:

1. when to use it
2. which docs to consult
3. what good output looks like
4. which anti-patterns to avoid
5. which files or boundaries usually matter

Skills should stay small and sharply scoped.

### Initial Canonical Skill Set

Air Jam should not start with too many skills.

The initial template should ship with a small canonical set that covers the highest-value repeated decisions.

The recommended first wave is:

1. `plan-ledger`
2. `airjam-docs-workflow`
3. `game-architecture`
4. `game-state-and-rendering`
5. `controller-ui`
6. `host-surface`
7. `prefab-authoring`
8. `debug-and-test`

This is enough to shape the development loop without creating a second framework inside the template.

### Skill Ownership

#### `plan-ledger`

Purpose:

Keep `plan.md` and `suggestions.md` disciplined and useful.

Use when:

1. starting non-trivial work
2. changing implementation approach
3. closing checklist items
4. recording architecture decisions
5. capturing follow-up improvements

It should teach:

1. how to structure `plan.md`
2. when to update `plan.md`
3. what belongs in `suggestions.md`
4. how to keep active work separate from future improvements

#### `airjam-docs-workflow`

Purpose:

Teach the agent how to consult local docs, hosted docs, and the future docs CLI without reading everything.

Use when:

1. touching framework contracts
2. changing architecture
3. creating new systems or patterns
4. needing canonical guidance before implementation

It should teach:

1. docs consultation triggers
2. local-first docs behavior
3. when hosted docs are appropriate
4. how the future docs CLI should be used

#### `game-architecture`

Purpose:

Keep game structure modular, testable, and predictable from the start.

Use when:

1. creating new gameplay systems
2. introducing new folders or boundaries
3. deciding where logic should live
4. refactoring tangled game code

It should teach:

1. canonical `src/` structure
2. domain vs engine vs adapter boundaries
3. host vs controller vs shared boundaries
4. refactor-first escalation when structure is wrong

#### `game-state-and-rendering`

Purpose:

Teach how to use Air Jam lanes, Zustand, React, refs, R3F, and Three without creating rerender or ownership problems.

Use when:

1. creating or changing stores
2. handling per-frame gameplay logic
3. integrating R3F or Three objects
4. deciding between React state, store state, and refs

It should teach:

1. input lane vs replicated state vs signal lane
2. narrow store selectors
3. hot-path ref usage
4. React and R3F anti-patterns
5. render-loop discipline

#### `controller-ui`

Purpose:

Keep controller surfaces touch-first, minimal, and game-like.

Use when:

1. building gameplay controls
2. building lobby controller screens
3. designing touch interactions
4. reviewing controller UX quality

It should teach:

1. `absolute inset-0` gameplay shell rules
2. large touch target rules
3. no text selection rules
4. simple game-appropriate layout patterns
5. anti-patterns such as card-heavy or tiny-control UI

#### `host-surface`

Purpose:

Keep the host display clean, fluid, and structurally separate from overlays and chrome.

Use when:

1. building host gameplay screens
2. adding overlays
3. composing shell and game layers
4. reviewing host layout behavior

It should teach:

1. full-surface host layout rules
2. game surface vs shell vs overlay boundaries
3. overflow discipline
4. reusable host UI composition patterns

#### `prefab-authoring`

Purpose:

Teach how reusable scene/game objects should be structured so future tooling can scan them safely.

Use when:

1. creating reusable scene objects
2. exposing prefab config
3. standardizing scene content modules
4. preparing for future previews or editor tooling

It should teach:

1. prefab metadata structure
2. config schema shape
3. default prop patterns
4. preview metadata expectations
5. declarative prefab contracts

#### `debug-and-test`

Purpose:

Keep diagnostics, logging, and testing intentional from the start instead of bolted on later.

Use when:

1. debugging gameplay or transport issues
2. adding debug panels
3. using log sinks or diagnostics
4. adding tests for game logic and systems

It should teach:

1. framework diagnostics first
2. structured log usage
3. debug module placement
4. unit vs behavior test boundaries
5. how to keep core game logic testable without rendering

### Phase Rule

Air Jam should separate the first shipping skill set from optional later specialization.

#### Phase 1 Skills

These should ship in the first serious template pass:

1. `plan-ledger`
2. `airjam-docs-workflow`
3. `game-architecture`
4. `game-state-and-rendering`
5. `controller-ui`
6. `debug-and-test`

These cover the highest-frequency mistakes and the highest-value workflow structure.

#### Phase 2 Skills

These should follow once the first set is stable and genuinely useful:

1. `host-surface`
2. `prefab-authoring`
3. genre-specific controller patterns
4. advanced performance and optimization guidance

The rule is:

Do not ship a large skill library before the first small set proves it improves actual project outcomes.

### Skill Packaging Rule

Each project skill should stay lean:

1. `SKILL.md` should hold the workflow and decision rules
2. detailed examples and references should live under `references/`
3. scripts should exist only when deterministic repeated behavior is needed
4. assets should exist only when they are directly reused in output

Skills should not turn into giant prose manuals.

### Trigger Rule

Only use a skill when the task actually matches its boundary.

Do not load every skill for every task.

The point of the skill layer is targeted behavior, not blanket context loading.

## 5. Default Game Architecture

Air Jam templates should not start as one large React surface.

They should teach separation from the first commit.

### Recommended Structure

The intended shape is:

1. `src/app/`
2. `src/host/`
3. `src/controller/`
4. `src/game/domain/`
5. `src/game/engine/`
6. `src/game/systems/`
7. `src/game/entities/`
8. `src/game/prefabs/`
9. `src/game/scenes/`
10. `src/game/stores/`
11. `src/game/hooks/`
12. `src/game/ui/`
13. `src/game/adapters/`
14. `src/game/debug/`
15. `src/shared/`
16. `src/lib/`
17. `tests/`

### Boundary Rules

#### Host

`src/host/` should own host-only composition and shell behavior.

#### Controller

`src/controller/` should own controller-only composition and interaction surfaces.

#### Domain

`src/game/domain/` should hold pure gameplay rules, types, math, and deterministic decisions where practical.

This layer should be testable without React, R3F, or realtime transport.

#### Engine

`src/game/engine/` should orchestrate runtime execution, scene lifecycles, ticking, and system composition.

#### Systems

`src/game/systems/` should hold focused gameplay systems such as:

1. spawning
2. abilities
3. combat
4. pickups
5. scoring

#### Adapters

`src/game/adapters/` should isolate framework and runtime integration such as:

1. Air Jam SDK usage
2. R3F integration
3. audio integration
4. physics integration
5. network integration

React components and framework adapters should not become the core game model.

## 6. Prefab Contract

Air Jam should encourage prefabs as first-class reusable content units.

This matters both for current composability and for future editor or Studio workflows.

### Prefab Goals

A prefab system should make it possible to:

1. author reusable scene/game objects
2. expose configurable properties in a stable way
3. support preview generation later
4. allow folder scanning for future preset browsers
5. keep scene assembly composable instead of ad hoc

### Prefab Shape

A prefab should converge on a standard contract that includes:

1. metadata
2. default props
3. config schema
4. preview information
5. runtime component
6. tags or category

The exact file layout may evolve, but the contract should stay stable.

The key rule is:

Keep prefab definitions declarative and predictable enough for future tooling to inspect them safely.

## 7. State, Stores, and Rendering Discipline

Air Jam templates should explicitly teach how to use Zustand, React, R3F, and refs without creating avoidable rerender and architecture problems.

### State Rules

1. keep authoritative shared state separate from local UI state
2. avoid giant global stores
3. subscribe to narrow selectors
4. avoid pushing whole store objects through component trees
5. keep per-frame data out of React state when React rendering is not needed
6. use refs for hot mutable runtime values
7. keep store writes coarse and intentional
8. keep rendering concerns separate from domain decisions

### React and R3F Pitfalls To Avoid

1. per-frame React rerenders for simulation updates
2. gameplay logic trapped inside render components
3. uncontrolled closure bugs in frame handlers
4. casual overuse of fixed dimensions in gameplay surfaces
5. scene code that mixes debug concerns with hot-path runtime logic
6. unnecessary component churn where refs or instancing are the correct tool

The template should explicitly teach these pitfalls because AI systems will otherwise reproduce them repeatedly.

## 8. Controller UI Contract

Controller UIs must be designed for touch-first play, not for desktop web habits.

### Gameplay Controller Rules

1. gameplay controller UI should live inside an absolute `inset-0` root
2. avoid scroll for active gameplay surfaces
3. disable accidental text selection
4. use large touch targets
5. keep controls visually obvious and single-purpose
6. minimize text and dense hierarchy
7. avoid dashboard-style cards for gameplay
8. prefer simple game-like controls over generic web widgets
9. keep the UI contained and predictable under mobile browser constraints

### Lobby Controller Rules

Lobby flows may be more flexible, but should still prefer:

1. simple layout
2. large controls
3. minimal friction
4. optional scroll only when the flow truly needs it

### Controller Design Rule

Controller UI should feel like a game controller first and a webpage second.

## 9. Host UI Contract

The host surface should stay just as disciplined as the controller surface.

### Host Rules

1. the active game surface should fill an absolute `inset-0` root
2. gameplay should not accidentally overflow its shell
3. overlays should be layered intentionally, not mixed into gameplay layout casually
4. host chrome, game surface, and debug tools should stay composable
5. the play surface should not inherit random content-page layout constraints

## 10. Visual Design Rules

Air Jam should explicitly guide generated game UI away from generic web-app aesthetics.

### Canonical Position

Game UI should be:

1. clean
2. modular
3. composable
4. fluid
5. appropriate to the game genre

### Default Rules

1. avoid random HTML clutter
2. avoid SaaS-style card piles for gameplay
3. avoid emojis as icons
4. avoid fixed widths and heights unless structurally necessary
5. prefer fluid layouts
6. prefer reusable UI modules over bespoke one-off markup
7. choose interaction patterns based on the game genre
8. keep controller and host UI intentionally sparse

The framework should guide AI toward strong game-feeling interfaces rather than generic website output.

## 11. Debugging and Log Workflow

Debuggability should be designed in from the start.

Air Jam already has useful diagnostics and log sink infrastructure, and projects should teach agents how to use it intentionally.

### Debug Workflow

The default order should be:

1. framework diagnostics first
2. domain-level debug signals second
3. custom logs only where they add real value

### Structure Rules

1. debug panels should live in `src/game/debug/`
2. debug tooling should stay isolated from gameplay hot paths
3. logs should be structured and purposeful
4. debug-only surfaces should be removable without destabilizing core gameplay code
5. the template should explain how to use the framework log sink and diagnostics pipeline during normal development

## 12. Testing Contract

Testing should not be retrofitted after a project becomes hard to reason about.

The template should make testability part of the initial architecture.

### Testing Rules

1. domain logic should get unit tests
2. important gameplay systems should get focused behavior tests
3. transport and state edge cases should get targeted tests
4. tests should prefer observable behavior over implementation details
5. core game logic should stay testable without full rendering where practical

### Architecture Consequence

If a gameplay system is too entangled with React, R3F, or transport to test easily, that is usually a structure problem, not a testing problem.

## 13. Anti-Patterns To Make Explicit

Air Jam should teach not only what to do, but what to avoid.

Important anti-patterns include:

1. putting simulation logic directly in React render flow
2. using one mega store for unrelated concerns
3. mixing host, controller, and game concerns in the same module casually
4. relying on chat history instead of `plan.md` for project progress truth
5. duplicating docs and guidance across too many files
6. using hosted docs as the only source of framework guidance for a local template
7. building gameplay UI like a generic dashboard app
8. making quick fixes that harden the wrong architecture instead of refactoring

## 14. Acceptance Criteria

This model is working when all of these are true:

1. a new Air Jam template has one obvious active plan file
2. the template has one obvious improvement backlog file
3. the agent has one clear repo contract to follow
4. local docs cover the operational implementation loop
5. hosted docs remain searchable and syncable through an explicit path
6. skills teach workflows without becoming duplicate docs
7. generated games start from a modular testable structure
8. controller and host UI quality is constrained by clear contracts
9. state and rendering pitfalls are called out early
10. debug and testing expectations are visible from the start
11. Air Jam projects stay easy to evolve without growing accidental complexity

## Closeout Rule

This document should stay focused on the operating model for AI-native Air Jam development.

If a future implementation phase starts, that execution tracker should live in `docs/work-ledger.md` plus a dedicated bounded plan document, not here.
