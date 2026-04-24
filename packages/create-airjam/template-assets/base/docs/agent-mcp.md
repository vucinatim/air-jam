# Agent MCP

Use the Air Jam MCP for Air Jam-native workflows before falling back to ad hoc shell commands.

## What It Is

The project-local Air Jam MCP is the intended machine-facing path for:

1. project inspection
2. game inspection
3. canonical log reads
4. dev process lifecycle and status
5. runtime topology inspection
6. visual scenario discovery
7. visual capture execution and artifact inspection
8. quality-gate execution

The goal is to keep agents on explicit Air Jam contracts instead of forcing them to rediscover repo commands.

## Default Workflow

Start here:

1. `pnpm exec airjam mcp doctor --dir .`
2. the project already ships a committed `.mcp.json`
3. `pnpm exec airjam mcp init --dir . --force` only when you want to repair or regenerate that config
4. use the `mcp` script or `pnpm exec airjam-mcp` in your MCP-capable client

## Usage Rule

Use the Air Jam MCP first for:

1. `inspect_project`
2. `list_games`
3. `inspect_game`
4. `read_logs`
5. `start_dev`
6. `status`
7. `topology`
8. `list_visual_scenarios`
9. `capture_visuals`
10. `read_harness_snapshot`
11. `invoke_harness_action`
12. `run_quality_gate`
13. visual capture summary inspection

Use direct shell commands only when:

1. the MCP does not expose the required operation
2. you are doing one-off repo maintenance work outside Air Jam devtools boundaries

## Debugging Rule

For runtime or multiplayer issues:

1. start with `airjam.read_logs`
2. use `view=signal` first
3. narrow with `trace`, `room`, `controller`, `runtime`, `process`, or `source`
4. only add ad hoc logs after the canonical log stream is insufficient
5. prefer `airjam.topology` over manually reconstructing local endpoints
6. when a game exposes harness actions, prefer `airjam.read_harness_snapshot` and `airjam.invoke_harness_action` over brittle browser-only sequencing
7. use harness action metadata from `airjam.list_visual_scenarios`, `airjam.list_harness_sessions`, and `airjam.read_harness_snapshot` before guessing payload shapes

## Harness Rule

When you own the game code and the existing harness action surface is too thin:

1. add a game-owned harness action instead of automating the visible browser UI
2. prefer explicit verbs like `returnToLobby`, `startRound`, `setScore`, or `finishMatch`
3. include action descriptions and payload descriptions so future agents can discover the contract without source diving

## Quality Rule

Before finishing meaningful work:

1. run the smallest matching `airjam.run_quality_gate`
2. prefer focused checks first
3. broaden to the heavier project checks only when the change warrants it
4. for host/controller UI or gameplay presentation changes, run `airjam.capture_visuals` before sign-off
5. `airjam.capture_visuals` is a task-backed MCP tool; use a task-capable client flow for long-running captures instead of assuming a plain blocking request

## Notes

The MCP config is project-local and scaffolded by default.

Do not mutate global client configuration unless you explicitly mean to.
