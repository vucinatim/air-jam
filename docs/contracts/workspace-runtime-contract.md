# Workspace Runtime Contract

Last updated: 2026-10-10
Status: implemented public contract

A workspace declares one runtime CLI and its supported development modes.
Public devtools discover this declaration from the current directory or its
ancestors, then delegate launch and topology to that owning workspace. No root
SDK dependency or private product directory layout is required. Ordinary
standalone games need no declaration.

## Declaration

Root `package.json` owns the declaration:

```json
{
  "airjam": {
    "workspace": {
      "cli": "scripts/repo/cli.mjs",
      "modes": ["standalone-dev"]
    }
  }
}
```

`cli` resolves relative to the declared workspace root and must exist. `modes`
contains at least one of `standalone-dev`, `arcade-dev` or `arcade-test`. Invalid
declarations and unsupported modes fail before a development process starts.
The public framework declares standalone development; the private product owns
the additional Arcade modes.

## Delegated operations

Devtools execute the declared CLI with Node from the workspace root:

| Development mode | Launch arguments                       | Topology mode    |
| ---------------- | -------------------------------------- | ---------------- |
| `standalone-dev` | `workspace standalone:dev --game=<id>` | `standalone-dev` |
| `arcade-dev`     | `workspace arcade:dev --game=<id>`     | `arcade-live`    |
| `arcade-test`    | `workspace arcade:test --game=<id>`    | `arcade-built`   |

Topology inspection uses `workspace topology --game=<id> --mode=<topology-mode>`
and returns the JSON topology defined by the
[runtime topology contract](./runtime-topology-contract.md). Launch and topology
accept `--secure` when secure development is requested. Launch remains running
until stopped; devtools own process supervision, status and termination.

Workspace games are discovered through `games/*/airjam-template.json`. An
explicit game ID takes precedence. Otherwise devtools select the first game in
the name-ordered discovery list; no reference game receives special treatment.

## Shared machine surface

Use `@air-jam/devtools/context` for discovery and `@air-jam/devtools/dev` for
managed lifecycle and topology. CLI and MCP call these same implementations.
Workspace owners implement the declaration once rather than copying tooling or
depending on framework source paths.
