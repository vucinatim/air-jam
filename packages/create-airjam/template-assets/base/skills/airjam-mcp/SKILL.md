# Air Jam MCP

Use this skill when the project includes the Air Jam MCP and the task involves Air Jam-native dev workflows.

## Default Order

1. inspect the project through the Air Jam MCP first
2. inspect the relevant game through the Air Jam MCP
3. read canonical logs through the Air Jam MCP before adding custom logging
4. run the smallest relevant quality gate through the Air Jam MCP
5. fall back to shell commands only when the MCP does not expose the required operation
6. when host staging actions exist, read the published action metadata before guessing payloads

## Tool Bias

Prefer the Air Jam MCP for:

1. project and game inspection
2. unified dev log reads
3. dev process start/stop/status
4. topology inspection
5. visual scenario discovery
6. visual capture execution
7. live game-session reads and host staging action invocation
8. quality gates
9. visual capture summary inspection

If the game does not yet expose the control an agent needs, prefer adding a small game-owned host staging action over automating the visible browser UI.

If the template ships `src/game/contracts/agent.ts`, treat that file as the canonical semantic agent surface and use the MCP agent tools before inferring raw controller/store semantics.

When local UI verification matters, pair the Air Jam MCP with the current agent or client's built-in browser or in-app browser tooling first.

If Claude Code Desktop preview launches the app, use the committed `.claude/launch.json`; it runs Air Jam's preview-managed adapter for Claude Preview. If another browser or preview tool wants a launch command, use `pnpm run dev`.
Do not use raw `vite` for normal Air Jam development because it skips the local Air Jam backend.
If you need HTTPS/secure dev, use the normal `pnpm run dev -- --secure` flow.
For Claude Code or similar preview surfaces, keep host and preview controllers in the same visible preview screen when possible. Add multiple preview-controller windows from the host workspace for multiple local players instead of opening unrelated OS browser tabs unless the user asks for tabs.
For visible controller UI smoke proof, use real browser click/drag/release gestures on preview controllers. Do not synthesize pointer events into controller iframes from parent-page eval.
After editing host-only runtime refs, physics loops, or `useHostActionListener` side effects, hard refresh the host or run `pnpm exec airjam reset local` if actions appear duplicated or rendered state no longer matches replicated state.

Use secondary browser MCPs such as Chrome DevTools only when that first-party browser tooling is unavailable or when lower-level DOM, network, or performance inspection is required.

If a clean-slate project becomes non-trivial, add a small `src/game/contracts/agent.ts` surface and wire it through `src/airjam.config.ts` `agent` before the game's important semantics drift into UI-only flows.

Remember that `airjam.capture_visuals` is task-backed. If your MCP client cannot execute task-backed tools, switch to a task-capable client or run the equivalent Air Jam CLI or repo visual command directly.

Prefer direct shell commands for:

1. raw git operations
2. arbitrary file inspection not covered by the MCP
3. repo maintenance outside Air Jam devtools boundaries
