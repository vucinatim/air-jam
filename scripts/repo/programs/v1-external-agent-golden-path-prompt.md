# Air Jam 1.0 External-Agent Golden-Path Prompt

You are operating in a new empty workspace as the primary external developer.
Build a polished Air Jam game named **Signal Relay** and prove its complete
lifecycle using only the public artifacts and machine contracts available in
this workspace.

Run inputs:

- candidate package version: `{{candidateVersion}}`
- run identity: `{{runId}}`
- isolated staging platform: `{{stagingPlatformUrl}}`
- evidence directory: `{{evidenceDir}}`

Do not use Air Jam monorepo source, private maintainer docs, private filesystem
paths, or undocumented maintainer knowledge. Discover the supported workflow
from package help, generated project guidance, stable JSON, and MCP contract
inspection. Use `pnpm run dev` as the local development front door. Use the Air
Jam semantic game-session contract for reliable control and state assertions;
browser interaction is visual proof only.

## Product Contract

Create Signal Relay from the `minimal` scaffold as `signal-relay-{{runId}}`.
It is a two-to-four-player shared-screen reaction game:

1. controllers join and ready; any ready controller can start once at least two
   players are ready
2. the host presents one of four signals per round
3. the first correct answer wins one point
4. an incorrect answer locks that player out until the next round
5. the first player to three points wins
6. controllers can start a fresh match with play again, returning scores,
   round state, locks, and winner state to their initial values

Keep deterministic rule constants in `src/game/domain/rules.ts` and define the
winning score exactly as:

```ts
export const WIN_SCORE = 3;
```

The host is authoritative for membership, readiness, round selection, answer
validation, scores, winner selection, and reset. Controller input is explicit
and untrusted. Publish a game-owned semantic agent contract with stable action
IDs and snapshots sufficient to join two virtual players, ready them, start a
match, submit answers, inspect phase/round/scores/locks/winner, play again, and
close the session without reading UI internals.

## Required Proof Loop

Complete and retain evidence for this sequence:

1. create the project from registry-resolved candidate packages
2. discover the supported CLI, MCP, runtime, semantic-session, evaluation, and
   release surfaces
3. implement the product contract with focused domain tests
4. pass typecheck, lint, tests, and a production build
5. use a semantic game session to complete a multiplayer match
6. inspect authoritative snapshots, the unified log stream, and visible host
   and controller output
7. diagnose and repair the declared win-score fault if the run controller
   injects it after the initial passing checkpoint
8. rerun the complete evaluation
9. build and submit only a hidden release to the supplied isolated staging
   target
10. verify the hidden release and close all local sessions and processes

## Evidence Output Contract

The run controller owns the root manifest, normalized transcript, environment,
input, project Git, controller-command, and verifier records. You own the
machine-readable stage indexes below inside the supplied evidence directory:

- `commands/index.json`
- `sessions/index.json`
- `quality/index.json`
- `visual/index.json`
- `release/index.json`
- `failures/index.json`

Each index must be a JSON object with `contract`, `runId`, and `records` fields.
Use contract `air-jam-golden-path-evidence/v1`, the supplied run identity, and
non-empty records for every attempted stage. Records must point to retained
outputs by evidence-directory-relative path and include the command, tool,
session, capture, fault, or release identity; timestamps; result; and relevant
exit code, digest, or failure classification. Record failed attempts before
retrying. Never create placeholder success records or claim a visual, session,
quality gate, release, or repair that was not observed.

For a terminal non-passing run, update `failures/index.json` with the terminal
result (`failed`, `blocked`, or `invalid`), first failing stage, responsible
surface, reproducible observation, expected behavior, classification (`product`,
`client`, `environment`, `harness`, or `external`), and the stages not attempted
because of the failure. A later recovery does not remove earlier failure
records.

Never publish publicly or to production. Do not expose credentials in output.
Do not silently discard failed attempts. If a required capability is missing,
record the exact failure and the public surface that should have made it
discoverable, then stop in a machine-classifiable state rather than inventing a
private workaround.
