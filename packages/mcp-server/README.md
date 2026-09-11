# `@air-jam/mcp-server`

The official Air Jam MCP server exposes the same project, development,
evaluation, semantic game-session, and hosted-release services as the Air Jam
CLI.

## Discover and connect

```bash
pnpm exec airjam mcp doctor --dir . --json
pnpm exec airjam mcp config --profile portable --dir .
pnpm exec airjam-mcp
```

The portable project declaration is `.mcp.json`. Codex and Claude Desktop can
also use their explicit profiles through `airjam mcp config`.

For Claude Desktop, generate the client-global configuration for your game:

```bash
pnpm exec airjam mcp config --profile claude-desktop --dir . --json
```

The result includes the destination `configPath` and JSON `content`. In
Claude Desktop's **Settings > Developer > Edit config**, merge the `airjam`
entry into `mcpServers`, preserving any existing connectors. Restart Desktop
and check the server's connection status in Developer settings. This profile
pins the game's absolute directory so Desktop can find its installed MCP
package regardless of where the app launches. The `pnpm` executable must be
available to Desktop; if it cannot find it, use its absolute executable path
in the entry's `command` field.

Rendering a profile does not install it. `claude mcp add` registers a server
with Claude Code, not Claude Desktop. Use `airjam mcp doctor --dir . --json`
to inspect registration; registration alone does not prove a live connection.

## Complete evaluation

Call `airjam.evaluate` before sharing a game and again after any repair. It
runs typecheck, lint, tests, and the production build, returning one stable
`air-jam-complete-evaluation/v1` result. Use `airjam.run_quality_gate` when you
only need to narrow a failure.

For reliable gameplay assertions, use `airjam.open_game_session`,
`airjam.read_game_session`, `airjam.invoke_game_session_action`, and
`airjam.close_game_session`. Use `airjam.capture_game_session_visuals` to
capture the owning room's canonical host and controller views when the client
cannot launch its own browser. Browser interaction remains visual proof rather
than the primary automation lane.
