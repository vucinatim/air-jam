# Air Jam MCP

Use this skill when the project includes the Air Jam MCP and the task involves Air Jam-native dev workflows.

## Default Order

1. inspect the project through the Air Jam MCP first
2. inspect the relevant game through the Air Jam MCP
3. read canonical logs through the Air Jam MCP before adding custom logging
4. run the smallest relevant quality gate through the Air Jam MCP
5. fall back to shell commands only when the MCP does not expose the required operation
6. when harness actions exist, read the published action metadata before guessing payloads

## Tool Bias

Prefer the Air Jam MCP for:

1. project and game inspection
2. unified dev log reads
3. dev process start/stop/status
4. topology inspection
5. visual scenario discovery
6. visual capture execution
7. live harness snapshot reads and harness action invocation
8. quality gates
9. visual capture summary inspection

If the game does not yet expose the control an agent needs, prefer adding a small game-owned harness action over automating the visible browser UI.

If the template ships `src/game/contracts/agent.ts`, treat that file as the canonical semantic game-agent surface and use the MCP game-agent tools before inferring raw controller/store semantics.

Prefer direct shell commands for:

1. raw git operations
2. arbitrary file inspection not covered by the MCP
3. repo maintenance outside Air Jam devtools boundaries
