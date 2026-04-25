# Air Jam MCP And Agent Devtools Plan

Last updated: 2026-04-24  
Status: usable V2 landed

Current status:

1. Phase 0 and the usable V2 slice are implemented.
2. `@air-jam/devtools-core` now covers managed dev lifecycle, topology, visual scenario discovery, visual capture execution, logs, project inspection, and quality gates.
3. `@air-jam/mcp-server` now exposes the read tools plus `airjam.start_dev`, `airjam.stop_dev`, `airjam.status`, `airjam.topology`, `airjam.list_visual_scenarios`, `airjam.capture_visuals`, `airjam.list_harness_sessions`, `airjam.read_harness_snapshot`, `airjam.invoke_harness_action`, `airjam.connect_controller`, `airjam.send_controller_input`, `airjam.invoke_controller_action`, `airjam.read_runtime_snapshot`, and `airjam.disconnect_controller`.
4. `create-airjam` now scaffolds `@air-jam/mcp-server`, a committed `.mcp.json`, MCP-first agent guidance, and the `mcp` script by default.
5. `@air-jam/harness` is now the canonical package name for the harness system; visual scenarios and captures remain the primary shipped harness capability in this track.
6. live harness browser sessions can now register with the local dev server through a dedicated broker, so agents can discover and target an already-open visible host session instead of always launching an isolated hidden harness browser.
7. the monorepo itself now ships a committed root `.mcp.json` plus `pnpm mcp`, so the repo is MCP-usable without package-internal working-directory tricks.
8. harness actions now publish optional action metadata, `list_visual_scenarios` / live session inspection surface that metadata to agents, and first-party games now describe their harness verbs more explicitly.
9. Last Band Standing now exposes a game-owned `returnToLobby` harness action, so the visible-tab MCP demo can round-trip without falling back to browser clicks.
10. `airjam.capture_visuals` is now registered as a task-backed MCP tool with task-store support, so long-running visual captures can complete through the MCP task stream instead of timing out as plain request/response calls.
11. the task-backed capture path is now proven against both `standalone-dev` and `arcade-test`: a real stdio MCP client can complete `last-band-standing` standalone capture and `pong` Arcade lobby capture through `client.experimental.tasks.callToolStream(...)`.
12. the first repo-orchestration consolidation slice is landed too: repo game discovery, Arcade origin resolution, local-reference env key helpers, and repo topology surface builders now live in `packages/devtools-core/runtime/repo-workspace.mjs`, and the workspace CLI topology/dev helpers now consume that shared runtime module instead of carrying duplicate builder logic.
13. the second consolidation slice is landed too: workspace process-group helpers, build-artifact reuse helpers, URL readiness probing, standalone live stack startup, and Arcade built stack startup now live under `packages/devtools-core/runtime/`, leaving `scripts/workspace/lib/*` as thin re-export wrappers instead of a second owner of the same orchestration logic.
14. the third consolidation slice is landed too: foreground repo `standalone:dev` / `arcade:dev` orchestration now lives in `packages/devtools-core/runtime/workspace-dev-commands.mjs`, repo visual stack/capture orchestration now lives in `packages/devtools-core/runtime/repo-visual.mjs`, and a real standalone visual capture still completes through that new runtime-owner path.
15. the managed monorepo path now goes through that same shared runtime layer too: `packages/devtools-core/src/dev.ts` uses `packages/devtools-core/runtime/workspace-runtime-cli.mjs` for monorepo start/topology instead of bouncing through repo CLI scripts, so the remaining difference is mostly lifecycle policy rather than duplicate orchestration ownership.
16. the first virtual-controller/runtime-inspection lane is now landed: `@air-jam/devtools-core` owns controller-session connect/disconnect, raw controller input sends, controller action RPC sends, and runtime snapshot reads that can request authoritative `airjam:state_sync` store payloads over the real controller Socket.IO protocol.
17. those controller/runtime operations are now surfaced through MCP as first-class tools, and focused socket-backed `devtools-core` tests prove the transport end to end without falling back to browser automation or fake protocol stubs.
18. a new game-owned semantic agent-contract lane is now landed too: `@air-jam/sdk` publishes a `defineAirJamGameAgentContract(...)` helper with `projectSnapshot(...)` plus semantic `actions`, `@air-jam/devtools-core` can inspect/project/invoke those contracts for live controller sessions, and MCP now exposes `airjam.inspect_game_agent_contract`, `airjam.read_game_snapshot`, and `airjam.invoke_game_action`.
19. `last-band-standing` is the first real adopter of that higher-level lane, and the live stdio MCP path is now proven against a visible host room for contract inspection, controller connect, projected game snapshot reads, semantic ready/start/guess actions, and reveal/score readback.
20. `pong` is now the second real adopter of the same lane, and the live stdio MCP path is also proven against a visible Pong host room for two-controller join flow, lobby settings changes, semantic match start, semantic score awards, ended-state readback, and semantic return-to-lobby.
21. `src/airjam.config.ts` is now the canonical declaration site for machine-facing contracts too: `createAirJamApp({ game.machine })` carries semantic game-agent contracts directly and explicit visual-scenarios module declarations, and the high-level `@air-jam/devtools-core` / MCP / repo-visual path now requires those explicit declarations instead of falling back to convention-scanned contract files.
22. the closeout validation race is now removed at the test boundary: `@air-jam/mcp-server` tests no longer rebuild sibling workspace packages, both test suites resolve workspace package source directly through Vitest aliases, and `@air-jam/devtools-core` is the only suite that still prebuilds `@air-jam/sdk` because it dynamically imports real repo game configs that consume published SDK subpaths.

Related docs:

1. [Vision](../vision.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [AI-Native Development Workflow](../systems/ai-native-development-workflow.md)
4. [Harness Visual Contract](../systems/harness-visual-contract.md)
5. [Monorepo Operating System](../monorepo-operating-system.md)
6. [Work Ledger](../work-ledger.md)

## Purpose

Define the architecture for an official Air Jam MCP and agent devtools layer.

The goal is to let coding agents operate Air Jam projects through clean Air Jam-native contracts:

1. discover games and project capabilities
2. start and stop local dev runtimes
3. inspect runtime topology
4. read canonical unified logs
5. run visual harness scenarios
6. inspect screenshots and capture artifacts
7. invoke typed game-owned harness actions
8. read structured runtime snapshots
9. run focused quality gates
10. scaffold and maintain generated Air Jam projects

This should work in both:

1. this Air Jam monorepo
2. standalone games created with `create-airjam`

The MCP should make the agent loop faster and more reliable without creating a second framework model.

## Core Decision

Build shared devtools services first, then expose them through MCP.

Target shape:

```text
packages/devtools-core/
  shared typed operations for games, workspace, logs, visual capture, processes, quality gates

packages/mcp-server/
  MCP adapter over devtools-core

packages/create-airjam/
  ships project-local MCP setup, agent guidance, docs, and AI-pack update support

scripts/repo/
  repo maintainer CLI calls devtools-core instead of owning duplicate logic
```

The intended dependency direction:

```text
repo CLI          -> devtools-core
MCP server        -> devtools-core
create-airjam     -> devtools-core where it needs project setup or AI-pack validation
future Studio UI  -> devtools-core
```

The MCP must stay thin.

It should translate MCP requests into official Air Jam devtools operations. It should not become the owner of process orchestration, visual capture, log parsing, runtime inspection, or scaffold maintenance.

## Lifecycle Policy

The current lifecycle split is intentional.

Keep two local dev modes:

1. foreground repo CLI flow for humans
2. managed devtools flow for MCP and agents

Foreground repo CLI flow:

1. owns long-running terminal sessions for `standalone:dev`, `arcade:dev`, and `arcade:test`
2. is optimized for human-visible logs, direct Ctrl+C interruptibility, and maintainer workflows

Managed devtools flow:

1. owns `airjam.start_dev`, `airjam.stop_dev`, `airjam.status`, and agent-oriented start/inspect/act/stop loops
2. is optimized for machine-usable lifecycle and process tracking under `.airjam/devtools/`

The important constraint is not “one lifecycle style everywhere.” The important constraint is:

1. both modes must reuse the same shared runtime owners
2. neither mode should privately own topology building, stack startup, readiness, or visual stack orchestration
3. if one mode breaks and the other does not, the shared runtime layer is the first place to inspect

Only revisit a full lifecycle unification if we see real friction such as:

1. duplicate lifecycle bugs
2. mismatched cleanup semantics
3. agents needing foreground attach/detach behavior
4. humans needing managed session reuse

## Non-Goals

This plan does not try to:

1. make MCP the only way to use Air Jam devtools
2. replace the repo CLI
3. expose arbitrary shell command execution through MCP
4. expose secrets, environment files, or hosted credentials by default
5. create a broad plugin system before the core tools prove themselves
6. re-export unstable private SDK runtime seams as public APIs just to satisfy MCP
7. require users to globally install Air Jam tooling before generated games work

## Why This Matters

Air Jam's long-term direction is an AI-native game creation and evaluation harness.

For that to work, agents need direct, structured feedback loops. Browser automation alone is too fragile and too low-level.

Good agent tooling should let an agent:

1. boot a game
2. join or simulate controllers
3. inspect authoritative runtime state
4. trigger typed game-owned actions
5. read high-signal logs
6. capture host and controller visuals
7. compare outcomes across iterations
8. patch code
9. run validation
10. repeat until the game improves

The existing repo already has major pieces:

1. `air-jam-server logs` as the canonical unified dev log stream
2. repo workspace commands for standalone, Arcade, and topology modes
3. `@air-jam/harness` scenario packs, bridge snapshots, actions, and screenshots
4. `create-airjam` AI-pack files such as `AGENTS.md`, docs, skills, `plan.md`, and `suggestions.md`

The missing piece is one official machine-facing devtools surface that agents can discover and use without memorizing repo-specific commands.

## Runtime Modes

The MCP server should detect the project shape at startup.

### Monorepo Mode

Enabled when the current project is the Air Jam monorepo.

Signals:

1. root `package.json` name is `air-jam`
2. repo-local `scripts/repo/cli.mjs` exists
3. workspace packages such as `packages/sdk`, `packages/server`, and `packages/create-airjam` exist

Capabilities:

1. universal game tools
2. repo workspace tools
3. first-party game discovery
4. platform and Arcade dev workflows
5. release and scaffold smoke workflows
6. launch-set visual capture helpers

### Standalone Game Mode

Enabled when the current project is a generated or hand-authored Air Jam game.

Signals:

1. `package.json` depends on `@air-jam/sdk`
2. project has `src/airjam.config.ts` or equivalent config entry
3. project has generated Air Jam AI-pack files or docs

Capabilities:

1. universal game tools
2. local dev server tooling
3. local logs
4. visual harness tools if the project defines `visual/`
5. project quality gates
6. AI-pack status/update helpers

Repo-only tools must not appear in standalone mode.

## Package Design

### `@air-jam/devtools-core`

Owns typed operations and reusable process behavior.

Potential modules:

```text
src/context/
  detect-project-context.ts
  project-root.ts

src/games/
  list-games.ts
  inspect-game.ts
  game-capabilities.ts

src/workspace/
  start-dev.ts
  stop-dev.ts
  runtime-status.ts
  topology.ts

src/logs/
  read-dev-logs.ts
  parse-dev-log-entry.ts
  summarize-dev-log-window.ts

src/visual/
  list-scenarios.ts
  run-capture.ts
  read-capture-artifacts.ts
  list-prefabs.ts
  run-prefab-capture.ts

src/quality/
  run-quality-gate.ts
  package-scripts.ts

src/ai-pack/
  status.ts
  diff.ts
  update.ts

src/processes/
  process-registry.ts
  process-groups.ts
  cleanup.ts
```

Rules:

1. no MCP protocol logic in this package
2. no client-specific config generation in this package unless it is generic data
3. operations return structured JSON-friendly results
4. operations should include command echoes for transparency
5. long-running process handles should have stable IDs
6. errors should preserve the failed command, cwd, exit code, and useful log tail

### `@air-jam/mcp-server`

Owns MCP protocol registration and tool schemas.

Potential CLI:

```bash
pnpm exec airjam-mcp
pnpm exec airjam-mcp --project .
pnpm exec airjam-mcp --mode auto
pnpm exec airjam-mcp --mode monorepo
pnpm exec airjam-mcp --mode game
```

Rules:

1. no duplicated command orchestration
2. no raw shell escape hatch as a first-party tool
3. only expose tools valid for the detected project mode
4. tool descriptions should steer agents toward the correct debugging order
5. tools should be stable and conservative even if internal implementation changes

### `create-airjam` Integration

Generated projects should include the MCP server by default.

Preferred scaffold output:

```json
{
  "devDependencies": {
    "@air-jam/mcp-server": "^x.y.z"
  },
  "scripts": {
    "mcp": "airjam-mcp"
  }
}
```

The generator should also include:

1. project-local MCP config files for clients that support committed config
2. `AGENTS.md` guidance that tells agents to use Air Jam MCP first
3. local docs page such as `docs/agent-mcp.md`
4. optional local skill such as `skills/airjam-mcp/SKILL.md`
5. AI-pack update support so the guidance can evolve after scaffold creation

Default should be included. Users can opt out:

```bash
npx create-airjam my-game --no-ai-tools
```

or, if we want narrower control later:

```bash
npx create-airjam my-game --no-mcp
```

Do not make normal users globally install `@air-jam/mcp-server`.

## Installation And Client Config Strategy

The best dev experience is project-local and opt-out.

What we can do automatically:

1. add `@air-jam/mcp-server` to generated project dev dependencies
2. add `pnpm mcp`
3. add project-local MCP config templates where clients support them
4. add agent guidance files that instruct agents to use the Air Jam MCP
5. add a doctor command that explains any missing client-side registration

What we probably cannot do universally:

1. silently register with every MCP client
2. bypass a user's local trust prompt
3. mutate global Claude, Cursor, Codex, or editor config without explicit user action

Target helper commands:

```bash
pnpm exec airjam mcp doctor
pnpm exec airjam mcp init
pnpm exec airjam mcp config --client claude
pnpm exec airjam mcp config --client cursor
pnpm exec airjam mcp config --client codex
pnpm exec airjam mcp config --client generic
```

`mcp doctor` should report:

1. detected project mode
2. MCP server package status
3. available Air Jam tools
4. whether visual harness is configured
5. whether unified logs are available
6. suggested client config
7. common fix commands

## Agent Guidance Files

`create-airjam` already ships `AGENTS.md`, docs, skills, `plan.md`, and `suggestions.md`.

The generated guidance should add an explicit MCP rule.

Recommended `AGENTS.md` section:

```md
## Air Jam MCP Rule

Use the Air Jam MCP first for Air Jam-native workflows:

1. start or inspect local dev runtime
2. inspect runtime topology
3. read canonical unified logs
4. list and run visual harness scenarios
5. inspect visual capture artifacts
6. run project quality gates
7. inspect or update managed AI-pack files

Use shell commands only when the MCP does not expose the needed operation.

For multiplayer or runtime bugs, inspect logs before adding custom logging.
For host/controller UI changes, run visual capture before finalizing when the project has a visual harness.
For state/control issues, prefer runtime snapshots and harness actions over browser scraping.
```

The docs pack should include `docs/agent-mcp.md` covering:

1. what the MCP does
2. how to verify it is available
3. how agents should use it
4. when to fall back to shell commands
5. how visual harness scenarios fit the feedback loop
6. how to keep the AI pack updated

The local skill should be short and workflow-oriented:

1. use `airjam.inspect_project`
2. use `airjam.start_dev`
3. use `airjam.read_logs --view signal`
4. use visual capture for UI changes
5. use focused quality gates
6. update `plan.md` and `suggestions.md`

## Tool Catalog

The exact names may change, but the concepts should stay stable.

### Project And Game Tools

#### `airjam.inspect_project`

Returns:

1. project mode
2. package manager
3. Air Jam package versions
4. available scripts
5. known docs and AI-pack files
6. available tool groups

#### `airjam.list_games`

Monorepo:

1. returns all first-party repo games
2. includes game id, path, package name, metadata, visual support

Standalone:

1. returns the current game as one project game

#### `airjam.inspect_game`

Returns:

1. config path
2. app id / slug when available
3. host route
4. controller route
5. metadata export status
6. visual harness support
7. prefab support
8. known test/build scripts

### Runtime And Process Tools

#### `airjam.start_dev`

Inputs:

1. game id where applicable
2. mode: `standalone-dev`, `arcade-dev`, `arcade-test`
3. secure flag
4. optional port overrides

Returns:

1. process id
2. mode
3. urls
4. expected log file
5. topology summary

#### `airjam.stop_dev`

Stops a started process group by process id or mode.

#### `airjam.status`

Returns running Air Jam processes known to the devtools process registry.

#### `airjam.topology`

Returns the resolved runtime topology using the same model as the repo CLI and generated game runtime utilities.

### Logs And Diagnostics Tools

#### `airjam.read_logs`

Wraps the canonical unified log reader.

Inputs should mirror current log filters:

1. `view`
2. `source`
3. `trace`
4. `room`
5. `controller`
6. `event`
7. `process`
8. `level`
9. `runtime`
10. `epoch`
11. `consoleCategory`
12. `tail`

Defaults:

1. `view: "signal"`
2. bounded tail
3. no follow by default

#### `airjam.summarize_logs`

Optional later tool.

Returns:

1. grouped high-signal events
2. warnings/errors
3. room/controller lifecycle summary
4. likely next filters

### Visual Harness Tools

#### `airjam.list_visual_scenarios`

Returns:

1. game id
2. scenario ids
3. descriptions
4. supported modes
5. whether bridge actions exist

#### `airjam.capture_visuals`

Runs the visual capture path.

Inputs:

1. game id
2. scenario id optional
3. mode
4. secure flag

Returns:

1. artifact root
2. scenario metadata
3. screenshot paths
4. status
5. error details

#### `airjam.read_visual_artifact`

Reads the latest or selected visual capture metadata.

Returns:

1. summary
2. scenario status
3. screenshot file list
4. notes
5. error if failed

#### `airjam.list_prefabs`

Returns game-owned prefab capture entries when available.

#### `airjam.capture_prefab`

Runs one prefab capture with optional variant parameters.

### Runtime Snapshot And Harness Action Tools

These should be V2 unless they can be cleanly implemented through the current visual harness runner.

#### `airjam.read_runtime_snapshot`

Returns the current structured snapshot exposed by the game-owned bridge.

Important:

1. this should use the same bridge contract as visual harness scenarios
2. it should not scrape arbitrary DOM
3. it should return the game-owned snapshot shape as structured data

#### `airjam.invoke_harness_action`

Invokes a typed game-owned bridge action.

Rules:

1. action names are discovered from the game harness contract
2. payloads are validated by the game-owned action parser
3. errors preserve the game/action name and validation message

Examples:

1. `startMatch`
2. `endMatch`
3. `setScore`
4. `addBot`
5. `setPhase`
6. `seedScenario`

### Quality Gate Tools

#### `airjam.run_quality_gate`

Inputs:

1. `typecheck`
2. `lint`
3. `test`
4. `build`
5. `scaffold-smoke`
6. `release-check`
7. package filter

Rules:

1. standalone games expose only project-valid gates
2. monorepo mode exposes repo-wide and package-filtered gates
3. output includes command, status, duration, and useful failure tail

### AI-Pack Tools

#### `airjam.ai_pack_status`

Equivalent to generated-project AI-pack status checks.

#### `airjam.ai_pack_diff`

Reports managed file drift.

#### `airjam.ai_pack_update`

Updates managed AI-pack files only when explicitly invoked.

Rules:

1. never silently overwrite user-custom files
2. preserve the existing distinction between managed AI-pack files and local project ledgers
3. clearly report files changed

## Visual Harness Alignment

The visual harness should become the primary user-visible proof that MCP is valuable.

Current good pieces:

1. scenario packs are game-owned
2. bridge snapshots are typed
3. bridge actions validate payloads
4. host/controller screenshot capture already exists
5. prefab capture already exists for richer authored content

Near-term improvements to support MCP:

1. add a machine-readable scenario manifest without requiring execution
2. add a machine-readable bridge action manifest where feasible
3. make latest capture artifact discovery stable
4. standardize artifact metadata locations
5. expose capture summaries through `devtools-core`

Do not move game-specific staging flows into MCP.

Game-specific staging belongs in:

1. `visual/contract.ts`
2. `visual/scenarios.ts`
3. game-owned helper modules

MCP should discover and run those contracts.

## Runtime Control Direction

The first MCP release can rely on visual harness and existing dev flows.

The long-term target is stronger direct runtime control:

1. create room
2. join virtual controller
3. send typed controller input
4. inspect authoritative state
5. inspect controller presentation state
6. inspect runtime events
7. run repeatable gameplay trials

This should not be hacked into MCP directly.

It should become an Air Jam runtime/devtools contract that MCP can call.

Potential future packages or modules:

```text
packages/devtools-core/src/runtime-control/
packages/devtools-core/src/runtime-inspection/
packages/sdk/src/runtime-control/   # only if/when it becomes a deliberate public SDK lane
```

This should be designed around the existing Air Jam lane model:

1. input lane for high-frequency controller input
2. replicated state lane for authoritative snapshots
3. signal/command lane for explicit runtime and UX commands

## Security And Trust Model

MCP tools can start local servers, read logs, and inspect project files.

That is powerful enough to require guardrails.

Rules:

1. default project root is the current workspace
2. file reads are limited to project-owned paths unless a tool explicitly needs a known external config path
3. no environment secret dumping
4. no arbitrary command execution tool in V1
5. long-running processes are started only through known Air Jam commands
6. destructive operations require explicit tool calls with clear names
7. hosted publish/upload tools should be future work with stronger confirmation semantics
8. MCP should report commands it ran and where it ran them

Generated projects should not auto-register global MCP config without consent.

Project-local setup is good. Silent global mutation is not.

## Implementation Phases

### Phase 0. Contract Spike

Status: initial slice complete

Goal:

1. prove the tool surface and project detection model without committing too much API

Work:

1. create a small `@air-jam/devtools-core` package - done
2. implement project context detection - done
3. implement `inspect_project` - done
4. implement `list_games` - done
5. implement `read_logs` - done
6. implement `run_quality_gate` for a narrow set - done
7. add tests for monorepo and generated-game detection - done

Done when:

1. devtools-core can identify monorepo vs standalone game
2. operations return structured results
3. no MCP code owns core behavior

### Phase 1. MCP V1

Status: complete

Goal:

1. expose the first useful MCP surface for repo and standalone games

Work:

1. create `@air-jam/mcp-server`
2. add MCP tool schemas for project, logs, visual, and quality gates
3. expose only mode-valid tools
4. add `airjam-mcp` binary
5. add `mcp doctor`
6. add focused tests for tool registration and invalid mode filtering

V1 tool set:

1. `airjam.inspect_project`
2. `airjam.list_games`
3. `airjam.inspect_game`
4. `airjam.topology`
5. `airjam.read_logs`
6. `airjam.list_visual_scenarios`
7. `airjam.capture_visuals`
8. `airjam.read_visual_artifact`
9. `airjam.run_quality_gate`
10. `airjam.ai_pack_status`

Done when:

1. an MCP-capable agent can inspect a project, read logs, run visual capture, and run validation without raw command memorization
2. unsupported repo-only tools are hidden in standalone games

### Phase 2. `create-airjam` Default Integration

Status: complete

Goal:

1. make generated projects MCP-ready by default

Work:

1. add `@air-jam/mcp-server` to generated project dev dependencies
2. add `mcp` script
3. add generated `docs/agent-mcp.md`
4. update generated `AGENTS.md`
5. add optional `skills/airjam-mcp/SKILL.md`
6. add MCP config templates where appropriate
7. add `--no-ai-tools` or `--no-mcp`
8. update scaffold smoke tests to verify MCP files and scripts

Done when:

1. a new project has project-local MCP available after install
2. agents are explicitly steered toward using it
3. users have an opt-out path

### Phase 3. Repo CLI Consolidation

Status: partial follow-on

Goal:

1. reduce duplicate orchestration by moving repo CLI internals toward `devtools-core`

Work:

1. migrate visual capture invocation wrappers where practical
2. migrate logs helpers where practical
3. migrate topology and dev process helpers where practical
4. keep command UX stable

Done when:

1. repo CLI and MCP share the important behavior paths
2. there is no parallel log or visual-harness implementation

### Phase 4. Runtime Control And Snapshot Loop

Status: initial slice complete

Goal:

1. support deeper agent feedback loops beyond screenshots and logs

Work:

1. design direct virtual-controller join/control contract
2. expose runtime snapshot reads through a stable devtools surface
3. expose game-owned harness action invocation outside full capture runs - done
4. add scenario loop helpers for repeated trials
5. define output shape for agent evaluation reports

Done when:

1. an agent can run a loop of start, control, inspect, capture, validate, patch, repeat
2. browser automation is no longer the primary control path for normal agent evaluation

## Testing Strategy

`devtools-core`:

1. unit tests for project detection
2. unit tests for command construction
3. fixture tests for monorepo and generated-game package shapes
4. log parser tests
5. visual artifact reader tests

`mcp-server`:

1. tool registration tests by project mode
2. schema validation tests
3. invalid tool/mode tests
4. command result serialization tests

`create-airjam`:

1. scaffold smoke verifies MCP script and dependency
2. AI-pack check verifies docs and `AGENTS.md` MCP guidance
3. opt-out smoke verifies omitted MCP files/dependencies

Repo integration:

1. run `pnpm --filter @air-jam/mcp-server test`
2. run `pnpm --filter @air-jam/devtools-core test`
3. run `pnpm test:scaffold`
4. run one visual capture through MCP in CI only if stable enough for the existing smoke budget

## Documentation Updates

Repo docs:

1. add this plan
2. add or update an MCP/devtools system doc once implementation starts
3. update [AI-Native Development Workflow](../systems/ai-native-development-workflow.md)
4. update [Monorepo Operating System](../monorepo-operating-system.md) if repo CLI internals move
5. update [Harness Visual Contract](../systems/harness-visual-contract.md) if manifests or artifact contracts change

Generated docs:

1. add `docs/agent-mcp.md`
2. update `docs/development-loop.md`
3. update `docs/debug-and-testing.md`
4. update the harness visual docs when the live session contract changes
5. update `AGENTS.md`
6. add `skills/airjam-mcp/SKILL.md` if the local skill model stays useful

## Open Decisions

### Package Names

Preferred:

1. `@air-jam/devtools-core`
2. `@air-jam/mcp-server`

Alternative:

1. `@air-jam/devtools`
2. `@air-jam/mcp`

Recommendation:

Use explicit names first. We can add shorter package aliases later only if they are genuinely useful.

### Default Scaffold Inclusion

Recommendation:

Include by default, with opt-out.

Reason:

The whole point is near-zero setup for agent-assisted Air Jam development. Making the best workflow opt-in weakens the product advantage.

### Client Config Files

Recommendation:

Ship safe project-local config templates, plus `mcp doctor`.

Do not silently mutate global client config.

### Tool Naming Stability

Recommendation:

Keep tool concepts stable even if exact names get refined during implementation.

Avoid too many narrow V1 tools. Add narrow tools only where they represent real Air Jam concepts.

### Runtime Snapshot Timing

Recommendation:

Do not force direct runtime snapshot/control into V1 if it requires reopening public SDK runtime seams.

Use visual harness snapshots first, then graduate the runtime inspection contract deliberately.

## Risks

### Risk: MCP Becomes A Parallel CLI

Mitigation:

1. put behavior in `devtools-core`
2. keep MCP as an adapter
3. migrate repo CLI paths toward shared operations

### Risk: Tool Surface Gets Too Broad

Mitigation:

1. no arbitrary shell tool
2. expose Air Jam concepts only
3. hide mode-invalid tools
4. keep V1 small

### Risk: Generated Projects Get Too Heavy

Mitigation:

1. keep MCP package dev-only
2. do not add runtime dependencies to shipped games
3. make AI tools opt-out
4. keep generated docs short and practical

### Risk: Visual Harness Contracts Are Too Runtime-Coupled

Mitigation:

1. keep staging game-owned
2. expose scenario/action manifests as metadata
3. avoid scraping DOM when a bridge snapshot should exist

### Risk: Client-Specific MCP Setup Drifts

Mitigation:

1. keep client config generation behind `airjam mcp config`
2. test generic config output
3. document unsupported clients as manual configuration

## Success Criteria

V1 is successful when:

1. a generated Air Jam project includes MCP support without manual package installation
2. an MCP-capable agent can discover project capabilities from the MCP
3. the agent can start dev or identify how to start dev through the MCP
4. the agent can read canonical logs through the MCP
5. the agent can run a visual harness capture through the MCP when the project supports it
6. the agent can run focused validation through the MCP
7. repo-only tools are not exposed to standalone games
8. generated `AGENTS.md` tells agents when and how to use the MCP
9. the repo CLI and MCP do not duplicate major behavior

Longer-term success is when:

1. agents can drive gameplay through direct runtime/control contracts
2. visual and runtime feedback loops are fast enough to use repeatedly during implementation
3. create-airjam projects feel agent-native immediately after scaffolding
4. future Air Jam Studio can reuse the same devtools core instead of building a separate orchestration system
