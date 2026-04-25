# Game Source Scaffolding Plan

Last updated: 2026-04-02  
Status: archived completed baseline

Archived on 2026-04-07 after the scaffold/export baseline landed.
Current release execution now lives in [Work Ledger](../work-ledger.md) and [V1 Release Launch Plan](../plans/v1-release-launch-plan.md).

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [Monorepo Operating System](../monorepo-operating-system.md)
4. [AI-Native Development Workflow](../systems/ai-native-development-workflow.md)
5. [V1 Release Launch Plan](../plans/v1-release-launch-plan.md)

## Purpose

Define the cleanest canonical way to turn real repo-owned Air Jam games into scaffoldable `create-airjam` templates without maintaining duplicate template source trees.

This plan exists because the current direction is clearly converging toward:

1. `games/` as the home for real repo-owned games
2. `create-airjam` as the public scaffold/export tool
3. `pong` and `air-capture` as both real reference games and real public starting points

The goal is to make that relationship explicit and durable so template behavior does not drift away from the actual games we build and maintain.

## Core Position

Air Jam should have one source of truth for scaffoldable games.

That means:

1. real games live in `games/`
2. scaffoldable templates are exported from those real games
3. `create-airjam` owns the export pipeline, not duplicate app copies
4. “template” means “export this repo game into a clean standalone project”

The system should optimize for one understandable happy path:

1. build a game normally
2. mark it scaffoldable if appropriate
3. export it through one shared pipeline
4. prove in CI that it still scaffolds correctly

## Non-Goals

This plan is not for:

1. making every repo game automatically public/scaffoldable
2. adding arbitrary per-game export scripts as the default model
3. supporting backward compatibility with older duplicated template layouts forever
4. turning `create-airjam` into a general monorepo copier with custom mutation hooks everywhere
5. reopening the current prerelease launch path

## Desired End State

Air Jam should support this canonical workflow:

1. repo-owned games live under `games/<id>`
2. a scaffoldable game declares a tiny export manifest
3. `create-airjam` discovers scaffoldable games from `games/`
4. users can run:
   1. `pnpm create airjam --template=pong`
   2. `pnpm create airjam --template=air-capture`
   3. `pnpm create airjam` and pick interactively when no template is provided
5. the generated project is derived from the real game source through one shared export pipeline
6. CI proves every scaffoldable game still exports, installs, typechecks, and builds

The durable repo truth should become:

1. `apps/` = platform surfaces we operate
2. `games/` = repo-owned games
3. `packages/create-airjam` = exporter/scaffolder

## Current Baseline

The baseline implementation is now in:

1. `games/pong` and `games/air-capture` are the first scaffoldable source games
2. `create-airjam` discovers packaged scaffold sources generated from `games/`
3. `create-airjam` supports both `--template=<id>` and interactive selection when omitted
4. the duplicated Pong template source tree has been removed
5. `pnpm test:scaffold` is the canonical anti-drift proof for exported source games

## Architecture Direction

### 1. `games/` Is The Source Of Truth

All scaffoldable game templates should come from `games/`, not from a second template-only source tree.

Rules:

1. games are authored as normal games first
2. games should not carry “template mode” branching in their runtime code
3. scaffoldability is an export concern, not a gameplay concern
4. if a game is not suitable for public scaffolding, that should be an explicit opt-out

### 2. One Shared Export Pipeline

`create-airjam` should own one exporter that transforms a real repo game into a standalone project.

The exporter should handle:

1. source file copying
2. repo-only file stripping
3. package/config normalization
4. placeholder or structured metadata rewrites
5. scaffold metadata generation

The exporter should not:

1. guess game intent from arbitrary folder contents
2. branch into bespoke game-specific logic by default
3. mutate gameplay code unless packaging requires it

### 3. Tiny Per-Game Manifest, Not Custom Scripts

Scaffoldable games may need a small manifest, but that manifest should stay declarative and narrow.

Minimum expected responsibilities:

1. template id
2. display name
3. short description
4. category such as `starter` or `reference`
5. optional exclusions or metadata overrides

The default position should be:

1. shared exporter rules do the work
2. per-game manifest only fills in metadata and a small number of exclusions
3. custom executable game-specific export scripts are an exception, not the model

### 4. Structured Rewrites Over String Guessing

For machine-readable files, the exporter should use structured rewrites rather than free-form text replacements.

Examples:

1. `package.json` should be updated as JSON
2. app/config fields should be updated structurally when practical
3. docs/README content may use a tiny placeholder vocabulary where structure is not worth parsing

This keeps export behavior deterministic and easy to reason about.

### 5. Explicit Export Boundary

A repo game can rely on monorepo assumptions during development.

A scaffolded project must not.

So the exporter must explicitly normalize:

1. workspace dependency references
2. package name and project name
3. repo-only scripts and workflow assumptions
4. generated docs or local helper files that should not ship into user projects

That boundary should live in the exporter, not be smeared through each game.

## Canonical Data Model

### Repo structure

Target structure:

```text
apps/
  platform/
games/
  pong/
  air-capture/
packages/
  create-airjam/
  sdk/
  server/
```

### Scaffold manifest

Each scaffoldable game should expose a small manifest file in its root.

Example shape:

```json
{
  "id": "air-capture",
  "name": "Air Capture",
  "description": "Advanced capture-the-flag reference game",
  "category": "reference",
  "scaffold": true,
  "export": {
    "exclude": ["dist", "node_modules", "coverage", "tsconfig.tsbuildinfo"]
  }
}
```

Rules:

1. keep the manifest tiny
2. prefer shared defaults over manifest options
3. avoid embedding executable logic in the manifest

## Export Pipeline

The canonical pipeline should be:

1. discover scaffoldable game manifests under `games/`
2. select the source game by `--template=<id>` or interactive prompt
3. copy the game into a temporary export workspace
4. strip repo-only files and generated artifacts
5. rewrite package/config metadata for the target project
6. normalize dependencies for standalone use
7. write scaffold metadata and docs
8. validate the exported project
9. place the final project in the requested output directory

There should be one main exporter module responsible for this flow.

## CLI Shape

The public scaffold UX should be:

```bash
pnpm create airjam
pnpm create airjam --template=pong
pnpm create airjam --template=air-capture
```

If `--template` is omitted:

1. show an interactive picker
2. present a short description and category for each scaffoldable game
3. keep `pong` legible as the simplest starter
4. keep `air-capture` legible as the advanced reference

The CLI should not expose multiple competing template-selection systems.

## Migration Strategy

This should land in phases so the happy path is proven before duplicate sources are removed.

### Phase 1. Introduce exporter and manifest discovery

Required outcomes:

1. `create-airjam` can discover scaffoldable games from `games/`
2. one exporter module exists with a narrow shared transform contract
3. `games/pong` becomes the first scaffoldable source game

### Phase 2. Prove parity with the current Pong scaffold

Required outcomes:

1. `--template=pong` exports from `games/pong`
2. the exported Pong project matches the current expected user behavior
3. scaffold smoke tests pass from the exported source-game pipeline

Rule:

1. do not remove the existing duplicate Pong template until parity is proven

### Phase 3. Add `air-capture` as an exportable advanced reference

Required outcomes:

1. `games/air-capture` gains a tiny scaffold manifest
2. `--template=air-capture` exports a working standalone game
3. the export passes install, typecheck, and build validation

### Phase 4. Remove duplicated template source where possible

Required outcomes:

1. duplicated scaffold source trees are retired once parity is real
2. the source-of-truth model becomes obvious in the repo
3. future scaffoldable games follow the same manifest + exporter path

## Testing Strategy

This plan only succeeds if export correctness is automated.

### Unit tests

Add focused tests for:

1. manifest discovery
2. export file filtering
3. structured package/config rewrites
4. placeholder replacement for text/docs files
5. dependency normalization

### Export integration tests

For each scaffoldable game:

1. export into a temp directory
2. assert expected files exist
3. assert forbidden files are removed
4. assert rewritten metadata is correct

### Real scaffold smoke tests

For each scaffoldable game:

1. export the project
2. install dependencies
3. run `typecheck`
4. run `build`
5. run configured smoke/tests when practical

This should become the real anti-drift gate.

## CI Contract

Air Jam should have one canonical export validation command:

1. `pnpm test:scaffold`

That command should:

1. enumerate all scaffoldable games
2. export each one through the shared pipeline
3. install dependencies
4. run `typecheck`
5. run `build`
6. run per-template smoke validation where configured

If a game is marked scaffoldable, CI should prove that status continuously.

## Risks To Avoid

1. silently keeping duplicate template source trees after the exporter exists
2. making the exporter depend on many game-specific hacks
3. letting each game define its own custom export scripting model
4. hiding packaging assumptions inside gameplay code
5. exposing scaffoldable games publicly before export CI proves them

## Done When

This plan is complete when:

1. scaffoldable games are sourced from `games/`, not duplicated template app trees
2. `create-airjam` supports `--template=<id>` and interactive selection
3. `pong` exports from its real source game with parity to the current scaffold UX
4. `air-capture` exports as a working advanced reference game
5. CI continuously proves every scaffoldable game still exports cleanly
6. the repo has one obvious happy path for adding future scaffoldable games
