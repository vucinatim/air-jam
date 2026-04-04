# Air Jam Project Contract

This project is designed to work well with both humans and coding agents.

The goal is not fast messy output.

The goal is to keep the game easy to grow, easy to test, and easy to refactor as scope increases.

## First Read Order

For any non-trivial task, read these in order:

1. `plan.md`
2. `docs/docs-index.md`
3. `skills/index.md`
4. the relevant code you are about to change
5. the template `README.md` if it includes a concrete starter module map

Do not treat chat history as the source of truth for project state.

## Core Workflow

For meaningful work:

1. read the current `plan.md`
2. inspect the existing structure before coding
3. consult the smallest relevant local docs slice
4. consult the matching skill only when the task fits that skill boundary
5. if the repo includes starter modules that already demonstrate the boundary, extend those before creating a new home for the work
6. refactor first if the requested change clearly does not fit the current structure
7. implement the smallest correct change
8. update `plan.md`
9. record durable follow-ups in `suggestions.md`
10. run relevant validation

## Canonical Local Files

### `plan.md`

This is the active ledger.

Use it for:

1. current goal
2. active checklist
3. progress notes
4. architecture decisions
5. blockers
6. next actions

### `suggestions.md`

This is the durable improvement backlog.

Use it for:

1. refactor opportunities
2. architecture improvements
3. DX upgrades
4. performance follow-ups
5. testing gaps

Do not use it as the current task tracker.

### `docs/`

This is the local operational docs pack.

Use local docs first.

Use hosted Air Jam docs only when:

1. local docs do not cover the topic
2. you need the latest canonical public guidance
3. the task is explicitly about updating or syncing docs
4. you need to inspect whether the local AI pack is behind the hosted canonical pack via `npx create-airjam ai-pack status --dir .`

### `skills/`

These are local workflow modules.

They teach how to work in this repo.

Do not load all skills for every task.

Use the one that matches the current problem.

## Architecture Rules

Keep boundaries explicit:

1. `src/host/` owns host-only composition
2. `src/controller/` owns controller-only composition
3. `src/game/domain/` owns pure game rules and types
4. `src/game/engine/` owns runtime orchestration
5. `src/game/adapters/` owns framework and transport integration
6. `src/game/ui/` owns game-facing UI modules
7. `src/game/prefabs/` owns reusable authored content with stable metadata and config

If the repo still uses an older structure, move toward this model instead of adding more mixed concerns.

## State And Rendering Rules

1. keep high-frequency input out of replicated store actions
2. keep authoritative gameplay state separate from local UI state
3. do not use one mega store for unrelated concerns
4. use narrow Zustand selectors
5. keep per-frame runtime values out of React state when React rendering is not needed
6. use refs for hot mutable values
7. keep simulation logic out of React render flow

### 3D Rule

If the project uses R3F or Three:

1. keep scene code separate from gameplay rules
2. establish a deliberate lighting and shadow setup early
3. keep grounding and placement deterministic
4. use Rapier only when true physics behavior adds real value

### 2D Rule

If the project uses canvas:

1. keep gameplay rendering in canvas, not DOM layout
2. keep simulation and drawing separate
3. keep world units separate from screen and CSS sizing
4. use generated SVGs only when they are curated into a consistent art language

## UI Rules

### Controller

1. gameplay controller UI should live inside an absolute `inset-0` root
2. prefer large touch targets
3. disable accidental text selection
4. avoid dense dashboard-like layouts
5. keep controls obvious and simple

### Host

1. the active game surface should fill an absolute `inset-0` root
2. avoid accidental overflow
3. keep overlays separate from gameplay layout
4. keep host shell modules separate from gameplay viewport modules

### Visual Direction

1. avoid random HTML clutter
2. avoid emoji-as-icon UI
3. prefer fluid layouts over hard-coded sizes
4. build reusable game UI modules instead of one-off markup
5. when the template already ships a visual system, extend its theme tokens and semantic utilities before adding new ad hoc styling

### Icon Rule

Prefer:

1. `@tabler/icons-react` for shell, menus, navigation, settings, and system actions
2. `react-icons` `Gi*` exports for abilities, status effects, pickups, damage types, and other gameplay-facing symbols

Do not mix many icon libraries casually.

Wrap icon usage behind local UI/game icon modules where practical so the project can swap or curate icons later.

## Prefab Rules

1. reusable content should live under `src/game/prefabs/`
2. keep prefab metadata, defaults, and runtime component boundaries clear
3. keep prefab placement deterministic instead of relying on hand-tuned floating offsets
4. move larger rules into domain or system modules instead of hiding them inside prefab components

## Testing And Debugging Rules

1. keep gameplay logic testable without full rendering where practical
2. add unit or behavior tests when changing real behavior
3. inspect the canonical Air Jam dev log stream early for multiplayer/runtime issues
4. prefer `pnpm exec air-jam-server logs`, or read `.airjam/logs/dev-latest.ndjson` directly
5. remember that `dev-latest.ndjson` resets when the Air Jam server process restarts
6. use framework diagnostics after the canonical log stream, not instead of it
7. keep debug helpers isolated from hot gameplay paths
8. if the local AI workflow files look stale or inconsistent, inspect them with `npx create-airjam ai-pack status --dir .` and `npx create-airjam ai-pack diff --dir .`
9. only use `npx create-airjam ai-pack update --dir .` when you want to replace managed AI pack files explicitly; it does not merge local customizations

## Escalation Rule

If a requested change clearly requires a cleaner boundary, say so directly and do the refactor first or split the work into:

1. boundary cleanup
2. feature implementation

Do not preserve a weak structure just because the short-term patch looks smaller.

Always suggest the next highest long term value task at the end of your response.
