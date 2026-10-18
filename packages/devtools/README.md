# Air Jam Devtools

The Node authoring and evaluation toolchain shared by Air Jam CLI, MCP and
Studio consumers. Games use `@air-jam/sdk`; tools use the explicit devtools
module that owns their operation. There is no catch-all root import.

## Entry points

| Import suffix         | Responsibility                                                    |
| --------------------- | ----------------------------------------------------------------- |
| `context`             | Discover and inspect a game or declared workspace                 |
| `games`               | Inspect games and their available capabilities                    |
| `dev`                 | Start, inspect, reset and stop managed development                |
| `logs`                | Read the unified development log stream                           |
| `controller`          | Connect virtual controllers, send input and inspect runtime state |
| `agent`               | Inspect semantic game contracts and invoke actions                |
| `game-session`        | Own a complete semantic playtest session                          |
| `game-session-broker` | Broker sessions for tool hosts                                    |
| `visual`              | List scenarios and capture game visuals                           |
| `harness/visual`      | Define and run visual or prefab capture harnesses                 |
| `quality`             | Run project quality gates and complete evaluations                |
| `mcp-config`          | Inspect, write and repair project MCP configuration               |
| `platform-auth`       | Authenticate optional hosted operations                           |
| `platform-games`      | Manage optional hosted game metadata                              |
| `platform-game-media` | Manage optional hosted game media                                 |
| `release`             | Prepare and operate optional hosted releases                      |

Functions and their public option/result types share an entry point:

```ts
import { startDev, type StartDevOptions } from "@air-jam/devtools/dev";

const options: StartDevOptions = { cwd: process.cwd(), mode: "standalone-dev" };
const development = await startDev(options);
```

CLI and MCP are the normal human/agent front doors. Import these modules when
embedding the same operations in another tool host. Packaged executable helpers
are implementation details used by that version of devtools, not independent
public entry points.

## Workspace and package contracts

Ordinary game projects need no workspace declaration. A workspace owns its
entrypoint and supported modes through the
[workspace runtime contract](../../docs/contracts/workspace-runtime-contract.md),
not through a guessed repository layout or a root SDK dependency.

All six Air Jam packages release together. Upgrade the coordinated family
together; documented module exports and their types follow the
[public support contract](../../docs/contracts/public-package-support-contract.md).
Hosted clients are optional: local development, inspection and evaluation do
not require an Air Jam platform account.

## Owned process lifetime

Owned runtimes and policy/evaluator helpers enter a process scope before loading
game profiles or opening browser pages. One guardian per tool process owns their
cleanup. POSIX uses marked process groups, inherited ownership and creation
identities; its recovery records live under `.airjam/devtools/process-scopes`.
Windows uses verified kernel jobs with kill-on-close and no breakaway. Windows
PowerShell must permit the packaged job helper; blocked initialization fails
admission without weakening the machine's policy.
Set `NODE_DEBUG=airjam-process-scope` to inspect Windows guardian startup phases.
Failures include bounded startup diagnostics without requiring debug logging.

Closing a direct child is insufficient. Stop and unexpected root exit close the
scope and require a bounded cleanup receipt. A lost broker triggers the same
cleanup through the guardian. Unconfirmed cleanup refuses further admission;
Studio can preserve the draft and recycle game compute. Other scopes remain
independent. These mechanisms manage trusted process lifetimes; the container or
VM remains the boundary for hostile game code and filesystem access.
