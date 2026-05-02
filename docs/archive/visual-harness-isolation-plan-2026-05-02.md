# Visual Harness Isolation Plan

Last updated: 2026-05-02  
Status: archived complete on 2026-05-02

Related docs:

1. [Prerelease Agent Dev Loop Hardening Plan](../plans/prerelease-agent-dev-loop-hardening-plan.md)
2. [Agent Control System Rewrite Plan](./agent-control-system-rewrite-plan-2026-05-02.md)
3. [Air Jam MCP And Agent Devtools Plan](./air-jam-mcp-and-agent-devtools-plan-2026-05-02.md)
4. [SDK Game Authoring Ergonomics Plan](../plans/sdk-game-authoring-ergonomics-plan.md)
5. [Harness Visual Contract](./harness-visual-contract-2026-05-02.md)

## Purpose

Ghost the visual harness from the public Air Jam authoring story before prerelease.

The visual harness should remain available only as an internal experimental subsystem until we decide whether to delete it completely. New users, scaffolded projects, and coding agents should not see it as a normal workflow, a normal SDK surface, or a recommended testing path.

The new public mental model should be:

```text
Browser preview shows what players see.
Agent contract performs reliable game actions and assertions.
Unified logs explain runtime behavior.
```

Anything visual-harness-specific should move out of the happy path.

## Completion Snapshot

This isolation pass is complete.

Landed:

1. generated projects no longer ship visual harness files, config, docs, or happy-path guidance
2. first-party games no longer publish visual harness contracts by default
3. the public SDK authoring surface no longer exposes `visualScenariosModule`
4. normal devtools project/game inspection no longer advertises visual capability metadata
5. active docs now teach browser preview, semantic agent contracts, logs, status, and reset as the normal machine-development path
6. visual MCP tools remain internal experimental tools and are hidden from the normal listed tool surface
7. first-party and scaffold validation now guard against visual harness leakage back into default templates

What remains on purpose:

1. `packages/harness` still exists as an internal experimental subsystem
2. hidden/internal devtools and MCP visual code still exists for internal use and historical comparison
3. archived docs preserve the previous design history without leaving it in the active authoring story

## Core Decision

The visual harness is no longer part of the normal Air Jam framework paradigm.

It is not the recommended way to get visual feedback. Agents and humans should use the embedded preview browser, Chrome/Playwright/browser tooling, and ordinary screenshots for visual inspection.

It is not the recommended way to stage gameplay. Agents should use `src/game/contracts/agent.ts` through game-session actions.

It is not the recommended way to debug runtime state. Agents should use the unified logs, `airjam status`, `airjam reset local`, and game-session snapshots.

The visual harness can remain in the repository as an internal experimental lane, but it should no longer appear in scaffolded guidance, first-read docs, or normal MCP instructions.

## Why Now

Recent Claude Code tests showed that the productive loop is:

1. use `.claude/launch.json` to open the embedded preview reliably
2. use visible preview controllers for UI smoke proof
3. use the semantic agent contract for reliable gameplay proof
4. use logs/status/reset for runtime diagnostics

The visual harness did not materially help this loop. Instead it adds a second scenario/control vocabulary, extra docs, extra config fields, and confusing MCP tools.

For prerelease, fewer first-class paths is better.

## Current Seams To Isolate

### Scaffolded AI Pack

Current generated project guidance still references visual harness concepts in:

1. `packages/create-airjam/template-assets/base/AGENTS.md`
2. `packages/create-airjam/template-assets/base/docs/agent-gold-path.md`
3. `packages/create-airjam/template-assets/base/docs/agent-mcp.md`
4. `packages/create-airjam/template-assets/base/docs/harness-visual.md`
5. `packages/create-airjam/template-assets/base/docs/visual-system.md`
6. `packages/create-airjam/template-assets/base/skills/airjam-mcp/SKILL.md`
7. generated docs under `packages/create-airjam/template-assets/base/docs/generated/`

These should stop teaching visual scenarios and visual capture as normal actions.

### Scaffolded Templates

Some first-party templates currently publish `visualScenariosModule` from `src/airjam.config.ts`, including at least:

1. `games/pong`
2. `games/air-capture`
3. `games/code-review`
4. `games/last-band-standing`
5. `games/the-office`

Generated projects should not include `src/game/contracts/visual-scenarios.ts`, `src/game/contracts/visual-bridge.ts`, or `visualScenariosModule` unless the user explicitly opts into an experimental/internal path.

### MCP And Devtools

The MCP/devtools surface currently exposes visual tooling such as:

1. `airjam.list_visual_scenarios`
2. `airjam.capture_visuals`
3. visual scenario metadata in project/game inspection
4. visual scenario discovery in devtools-core
5. repo visual commands under `scripts/repo/visual`

These should not be included in the normal agent tool story. If kept, they should be clearly marked internal/experimental and hidden from default instructions.

### SDK And Harness Exports

The public package surface currently makes visual harness APIs feel first-class:

1. `@air-jam/harness/visual`
2. `VisualScenarioPack`
3. `VisualScenarioContext`
4. `VisualHarnessRuntime`
5. related visual bridge/session APIs

Do not delete immediately. But move them toward an experimental namespace or at minimum remove them from normal docs and scaffold imports.

## Target State

### Generated Project Root

A new `create-airjam` project should contain no visual harness files by default:

1. no `src/game/contracts/visual-scenarios.ts`
2. no `src/game/contracts/visual-bridge.ts`
3. no `visualScenariosModule` in `src/airjam.config.ts`
4. no visual harness docs in the local docs pack
5. no visual harness skill
6. no guidance telling agents to run visual captures

### Normal Agent Instructions

Generated `AGENTS.md` and `CLAUDE.md` should say:

1. use browser/embedded preview for visual inspection
2. use preview controllers for visible controller UI smoke proof
3. use the agent contract for deterministic gameplay actions
4. use logs/status/reset for debugging

They should not mention visual scenarios, visual bridges, or visual captures.

### Normal MCP Surface

The normal agent-facing MCP story should center on:

1. inspect project/game
2. start/status/reset dev
3. read logs
4. open/read/invoke/close game sessions
5. run quality gates

Visual tools, if still registered, should be described as internal experimental tools and should not appear in generated happy-path docs.

### Internal Experimental Lane

The repo can keep the harness code temporarily for:

1. historical captures
2. internal comparison while we decide whether browser automation fully replaces it
3. possible future screenshot-regression experiments

But internal docs should call it experimental and not part of the public authoring path.

## Non-Goals

Do not do these in the first isolation pass:

1. delete `packages/harness`
2. delete all devtools visual code
3. delete all old visual capture artifacts
4. redesign screenshot regression testing
5. replace visual harness with a new browser automation framework
6. change the public agent contract model

The first pass is about removing public noise and default exposure.

## Workstreams

### Workstream 1: Scaffold And Docs Ghosting

Goal: generated projects should no longer teach the visual harness.

Tasks:

1. remove visual harness references from scaffold `AGENTS.md`
2. remove visual harness references from scaffold `CLAUDE.md` if any appear
3. rewrite `docs/agent-gold-path.md` around browser preview + agent contract + logs
4. rewrite `docs/agent-mcp.md` around game sessions and remove visual capture as a normal step
5. remove `docs/harness-visual.md` from the generated docs pack
6. remove or rewrite `docs/visual-system.md` if it is harness-specific
7. remove visual scenario/capture mentions from scaffold skills
8. regenerate generated docs and scaffold archives

Acceptance:

```bash
rg -n "visual-scenarios|visual-bridge|capture_visuals|visual harness|VisualScenario" packages/create-airjam/template-assets/base
```

should return no normal-path guidance. Any remaining hits must be explicitly internal/experimental or removed.

### Workstream 2: Template Output Cleanup

Goal: new `create-airjam` projects should not include visual harness files or config.

Tasks:

1. remove `visualScenariosModule` from scaffolded template `src/airjam.config.ts` files
2. remove `src/game/contracts/visual-scenarios.ts` from templates
3. remove `src/game/contracts/visual-bridge.ts` from templates
4. update `packages/create-airjam/scripts/check-scaffold-sources.mjs` so it no longer enforces visual scenario parity
5. confirm the minimal template has no visual harness surface
6. confirm a fresh generated project root stays clean

Acceptance:

```bash
pnpm --filter create-airjam templates:generate
pnpm --filter create-airjam templates:check
pnpm --filter create-airjam test
```

and a fresh minimal scaffold should have:

1. no `visual-scenarios.ts`
2. no `visual-bridge.ts`
3. no `visualScenariosModule`
4. no local docs telling agents to create those files

### Workstream 3: First-Party Game Quarantine

Goal: first-party games stop advertising visual harness as part of their normal contract.

Tasks:

1. remove or quarantine `visualScenariosModule` from first-party `src/airjam.config.ts`
2. move existing visual scenario files to an internal archive path or delete them if unused
3. remove `VisualHarnessRuntime` imports from host surfaces unless still needed internally
4. keep semantic `agent.ts` contracts as the first-class machine-action surface
5. update any tests that assumed visual harness publication

Possible quarantine shape:

```text
games/<game>/internal/visual-harness/
```

or:

```text
docs/archive/visual-harness-scenarios/<game>/
```

Prefer deletion if the files are only stale examples and not used by current release checks.

Acceptance:

```bash
rg -n "visualScenariosModule|VisualHarnessRuntime|visual-scenarios|visual-bridge" games
```

should show no first-party normal-runtime usage.

### Workstream 4: MCP And Devtools De-Emphasis

Goal: agents should not be encouraged to call visual tools during normal development.

Tasks:

1. remove visual capture/listing from MCP server instructions and generated skills
2. change tool descriptions for visual tools to say internal/experimental if they remain registered
3. ensure `open_game_session` does not wait on harness bridge readiness for agent-contract-only flows
4. update devtools project/game inspection output so visual harness metadata is either omitted from normal summaries or clearly marked experimental
5. keep `airjam.capture_visuals` task-backed behavior only for internal callers if still registered

Acceptance:

1. a normal agent reading MCP docs should choose game-session actions, not visual capture
2. `open_game_session` should work for an agent-contract game without visual harness publication
3. tests should cover contract-only session opening

### Workstream 5: SDK Export Boundary

Goal: visual harness APIs should no longer look like core Air Jam authoring APIs.

Tasks:

1. audit exports from `@air-jam/sdk` and `@air-jam/harness`
2. remove visual harness references from `packages/sdk/README.md`
3. if feasible before prerelease, move visual APIs under an experimental path
4. otherwise mark visual exports as `@experimental` in public comments and docs
5. make sure generated projects do not import `@air-jam/harness/visual`

Acceptance:

1. normal SDK docs do not introduce visual harness
2. scaffolded code does not import visual harness APIs
3. any remaining visual export is clearly experimental/internal

### Workstream 6: Repo Docs Reconciliation

Goal: repo-level docs describe the new simplified model.

Tasks:

1. update `docs/framework-paradigm.md`
2. update `docs/vision.md` only if needed
3. update `docs/docs-index.md`
4. update `docs/work-ledger.md`
5. archive or rewrite `docs/systems/harness-visual-contract.md`
6. update old active plans that still call visual harness primary

Do not spend time rewriting old archived plans. Archived docs can remain historically accurate.

Acceptance:

```bash
rg -n "visual harness|visual scenarios|capture_visuals|visual bridge" docs packages/create-airjam/template-assets/base
```

should show:

1. archived history
2. this isolation plan
3. internal/experimental references only

No current guidance should describe visual harness as a normal path.

## Suggested Implementation Order

1. scaffold docs ghosting
2. template output cleanup
3. `open_game_session` contract-only behavior fix
4. first-party game quarantine
5. MCP/devtools de-emphasis
6. SDK export boundary pass
7. repo docs reconciliation

This order removes user-facing noise first while avoiding a risky package deletion.

## Validation Gates

Run after each meaningful slice:

```bash
pnpm --filter create-airjam templates:check
pnpm --filter create-airjam test
pnpm --filter create-airjam typecheck
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
```

For scaffold proof, create a fresh minimal project only when explicitly requested, and use:

```bash
pnpm run repo -- scaffold local ../<test-project> --source=tarball --template=minimal
```

## Risks

### Hidden CI Dependency

Some release or smoke checks may still rely on visual capture. Find these before deleting files.

Mitigation: first isolate from scaffold/docs, then update tests and scripts deliberately.

### Package Export Breakage

External prerelease users may already import visual harness APIs.

Mitigation: avoid deleting exports in the first pass. Mark experimental and stop generating imports.

### Docs Drift

Several active plans still describe visual harness as part of agent workflows.

Mitigation: update current plans only. Do not rewrite archived history.

### Over-Correction

Browser screenshots are flexible but less deterministic than scenario captures.

Mitigation: keep the internal experimental lane until we decide whether screenshot regression matters after prerelease.

## Open Decisions

1. Should visual harness MCP tools remain registered but marked internal, or be hidden from normal tool registration entirely?
2. Should `@air-jam/harness/visual` move to an explicit experimental import path before prerelease?
3. Should old visual scenario files be deleted, moved under `internal/`, or archived under docs?
4. Should `packages/harness` eventually be renamed or split if only non-visual harness utilities remain useful?
5. Should browser screenshot workflows get a small first-party doc page, or is `CLAUDE.md` plus agent-gold-path enough?

## Final Target Summary

After this plan lands, the normal Air Jam story should be simple:

```text
Run the app.
Look at it in the browser.
Control it with preview controllers or phones.
Drive reliable game state through the agent contract.
Debug through logs/status/reset.
```

The visual harness should be invisible unless a maintainer intentionally goes looking for the internal experimental subsystem.
