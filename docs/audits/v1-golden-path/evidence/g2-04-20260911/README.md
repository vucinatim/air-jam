# Claude Desktop Independent Local Session Evidence

Run: `g2-04-20260911`
Status: passed independent secondary-client local session proof

## Preflight

- client: Claude Desktop `1.52386.0`, macOS arm64, incognito Chat mode
- client model shown in the UI: Opus 5 High
- package toolchain: Node `24.12.0`, pnpm `9.9.0`
- candidate version: `0.9.3`; source `09fc82ba` plus regenerated reference-game
  starter archives (not a frozen release candidate)
- bootstrap: `pnpm run repo -- golden-path bootstrap --keep-workspace --json`
  with supported Node 24 selected through the child command's `PATH`
- registry: run-owned loopback Verdaccio, public npm upstream for dependencies,
  no upstream fallback for Air Jam packages; stopped after installation proof
- workspace: newly generated Minimal project outside the monorepo, with
  registry-resolved dependencies; bootstrap verified no forbidden local specs
  or monorepo paths and matched installed integrity to candidate bytes
- bootstrap checks: MCP discovery, dev start/status/stop, typecheck, lint,
  tests, and build passed
- Desktop connection: output from the installed candidate's
  `airjam mcp config --profile claude-desktop --dir . --json`; absolute `pnpm`
  executable and Node 24 `PATH` supplied for the GUI launch environment
- local game/server ports: `49928` / `51192`, independent from the maintainer's
  running development stack
- Air Jam auth state: run-owned empty `AIRJAM_STATE_DIR`; `auth whoami`
  confirmed no stored session; platform URL constrained to the local test
  server, no production credentials supplied
- user approved temporary registration and its removal after the test;
  existing connectors preserved, tool approvals limited to Allow once

An initial preparation attempt on the ambient Node 25 stopped before
installation because four generated starter archives were stale. The canonical
template generator rebuilt them, archive verification passed, and the Node 24
bootstrap above succeeded. The failed attempt is not counted as a client run.

## Exact Prompt Sent to Claude

> Please test the new local Air Jam game project connected through the airjam MCP server. Independently discover its available tools/resources and inspect the project and game. Open one semantic game session, read the authoritative game state, invoke one advertised player action, verify its effect by reading state again, and close the session. Confirm cleanup and report the actual tool names, session/room IDs, before/after values, and any errors. Use only this local Air Jam connection; do not use other connectors, prior conversations, external websites, private repositories, or production services. Do not publish, upload, authenticate to a platform, or modify the game source. Discover action names and inputs from the available contracts rather than guessing. Proceed through the whole local test, including cleanup.

The run controller supplied no follow-up discovery hints or source changes.
Incognito excludes prior conversation memory; this is not a claim about the
vendor's organization-wide retention policy.

## Candidate Archive Digests

| Package archive | Bytes | SHA-256 |
| --- | ---: | --- |
| `air-jam-cli-0.9.3.tgz` | 393389 | `5b96b4c4cb3754ef0b53d32a1998b995cb632a63e079aa95e8326c4841bfe9d5` |
| `air-jam-mcp-server-0.9.3.tgz` | 703434 | `1a71ee06fba5a7e73b48eca263b3860f0369c216110b8849c48ea7404973f913` |
| `air-jam-sdk-0.9.3.tgz` | 1273238 | `7692b67a34522acfb51dc3dafa092896797cfc6383e4643d04953b098643f427` |
| `air-jam-server-0.9.3.tgz` | 232756 | `f6551b99972471214171909830ef136bbc122f8a6ed3b613c4cb6e34e2af74db` |
| `create-airjam-0.9.3.tgz` | 87166278 | `790a5cbb469fbef049a20d66dc31810f3f7ea24b2023d6bfd53f8eea2c0416bb` |

## Client and Runtime Result

Claude independently discovered the tools with three client tool searches and
completed 14 Air Jam calls. The actual session opened in room `R8SM`, accepted
`player:tap`, and a separate read confirmed `totalCount` and store revision
changed from `0` to `1`. Session closure succeeded; deliberately reading the
closed handle returned the expected unknown-session error. Claude stopped the
dev process it had started and confirmed the original empty process baseline.

The run controller independently repeated the CLI status read: no managed or
unmanaged processes remained on the two test ports. It removed only the
temporary `airjam` configuration entry, verified the original `chrome-devtools`
entry was unchanged, and restarted Desktop to unload the test MCP process.
The transport log records intentional shutdown at `20:29:22Z`.

[`result.json`](./result.json) contains the normalized client-observed IDs,
state delta, ordered tool calls, and independent cleanup checks.
[`transport.txt`](./transport.txt) contains only this Air Jam connection's
timestamped protocol metadata; it does not contain request bodies, capability
tokens, vendor credentials, or private conversation contents. Tool names and
outcomes come from the visible client transcript, not inferred from the
metadata-only transport log. Vendor reasoning was not retained.

The registry and runtime are stopped; candidate archives and the generated
workspace are retained locally for reproducibility. No production deployment,
public registry publication, or platform authentication occurred. This proves
the current candidate's secondary local client path, not a frozen release or
Claude duplicating the full primary coding lifecycle.

## Client Suggestions Triaged Separately

The client also suggested follow-ups after the passing test. They are not
automatically findings: source inspection confirms `openGameSession` already
acquires/starts a dev-process lease, and the top-level invocation result retains
the lane-qualified session action ID while its nested invocation names the
underlying game action. This run did not attempt a cold open or an unqualified
action ID. No compatibility aliases or redundant startup system were added.

Timestamp, controller-version, and query-capability observations were not
additional behavioral failures. Use store revision and authoritative snapshot
values for game-change assertions; LAN/TLS/security behavior remains outside
this loopback-only client's certification scope. No broader vulnerability claim
is inferred from the client's untested suggestions.
