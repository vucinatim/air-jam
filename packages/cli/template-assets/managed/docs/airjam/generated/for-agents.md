<!-- Generated from content/docs/for-agents/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://airjam.io/docs/for-agents -->

# For Agents

This page is the fastest entrypoint for LLM agents and automation tools.

## What Air Jam Is

Air Jam is an open AI-native framework for multiplayer games controlled by
phones.
Hosts run in your game, inputs are routed through the Air Jam server, and both
humans and agents work against typed controller, runtime, state, and release
surfaces instead of guessing through UI only.

Air Jam is the harness around your existing coding agent, not a separate hosted
editor. Local project instructions, CLI commands, MCP tools, runtime observations,
and hosted release services form one development path.

## Connect to a Project

Run these commands from a generated game project with dependencies installed:

```bash
pnpm exec airjam --help
pnpm exec airjam mcp doctor --dir . --json
pnpm exec airjam mcp config --profile portable --dir .
```

New projects include `.mcp.json`. If a project has no declaration, use
`pnpm exec airjam mcp init --dir .`; it does not overwrite an existing declaration
unless you explicitly pass `--force`.

Some clients use their own registration formats instead of reading `.mcp.json`:

```bash
pnpm exec airjam mcp config --profile codex --dir .
pnpm exec airjam mcp config --profile claude-desktop --dir .
```

These commands render configuration; they do not install it into the client.
Use the rendered command, arguments, and absolute project directory when adding
the server. `mcp doctor` distinguishes project declarations from detected client
registrations. Confirm that the connected client discovers Air Jam's tools before
treating the connection as working.

## Operate and Evaluate

For gameplay assertions, use `airjam.open_game_session`,
`airjam.read_game_session`, `airjam.invoke_game_session_action`, and
`airjam.close_game_session`. Read each session's published actions and state;
do not guess game-specific action IDs. `airjam.capture_game_session_visuals`
adds host and phone-controller screenshots to the same session.

MCP is optional. A terminal agent can use the same services:

```bash
pnpm exec airjam session open --dir .
pnpm exec airjam session read <session-id> --dir .
pnpm exec airjam session invoke <session-id> <action-id> --payload '{}'
pnpm exec airjam session capture <session-id> --dir .
pnpm exec airjam session close <session-id> --dir .
```

A session starts or reuses the canonical development process. If you start it
yourself, use `pnpm run dev`, not raw Vite. Use semantic state for repeatable
gameplay checks and rendered screenshots or browser interaction for visual polish.
During editing, run the relevant focused checks. Before sharing a completed game,
run `pnpm exec airjam evaluate --dir .` or the `airjam.evaluate` tool for the complete
typecheck, lint, test, and build result.

The [Quick Start publishing guide](https://airjam.io/docs/getting-started/quick-start#terminal-or-agent-publishing)
covers CLI authentication, hosted release submission, inspection, and explicit
publication. Local development and evaluation do not require hosted publishing.

## Read These First

1. [Introduction](./introduction.md)
2. [Quick Start](./quick-start.md)
3. [Architecture](./architecture.md)
4. [Host System](./host-system.md)
5. [Project Structure](./project-structure.md)
6. [Controller UI](./controller-ui.md)
7. [State and Rendering](./state-and-rendering.md)
8. [SDK Hooks](./sdk-hooks.md)
9. [Debugging and Logs](./debugging-and-logs.md)
10. [Unified Dev Logs](./unified-dev-logs.md)

## SDK Focus Areas

- [Input System](./input-system.md)
- [Networked State](./networked-state.md)

## Machine Discovery

- [AI Pack Manifest](/ai-pack/manifest.json)
- [LLMs Index](https://airjam.io/llms.txt)
- [Sitemap](https://airjam.io/sitemap.xml)
- [Robots](https://airjam.io/robots.txt)
