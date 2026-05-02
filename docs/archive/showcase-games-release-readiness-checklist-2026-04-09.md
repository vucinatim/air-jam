# Showcase Games Release Readiness Checklist

Last updated: 2026-04-08  
Status: archived

Archived on: 2026-04-09  
Archive reason: final manual launch proof was consolidated into [Final Prerelease Manual Check Plan](../plans/final-prerelease-manual-check-plan.md)

Related docs:

1. [Showcase Games Release Readiness Plan (Archived)](./showcase-games-release-readiness-plan-2026-04-09.md)
2. [V1 Release Launch Plan](../plans/v1-release-launch-plan.md)
3. [Work Ledger](../work-ledger.md)

## Purpose

Provide one concrete, repeatable sign-off checklist for the five launch-set games.

Use this document to record:

1. baseline contract pass/fail per game
2. the final outcome per game (`pass`, `pass with note`, `blocker`)
3. any notes required for launch decisions

## How To Use

For each game:

1. run the intended local Arcade proof path (`pnpm arcade:test --game=<id>`)
2. run fast iteration paths as needed (`pnpm arcade:dev --game=<id>`, `pnpm standalone:dev --game=<id>`)
3. validate against every checklist row below
4. update outcome and notes in the per-game records section

## Baseline Checklist Grid

Mark each cell for each game:

- `[x]` pass
- `[~]` pass with note
- `[!]` blocker
- `[ ]` not yet verified

| ID  | Checklist Item                                              | pong | air-capture | code-review | last-band-standing | the-office |
| --- | ----------------------------------------------------------- | ---- | ----------- | ----------- | ------------------ | ---------- |
| C1  | Host route opens from local Arcade without manual patching  | [x]  | [x]         | [x]         | [x]                | [x]        |
| C2  | Controller join works from QR/join flow                     | [ ]  | [ ]         | [ ]         | [ ]                | [ ]        |
| C3  | Controller reaches intended controller UI cleanly           | [ ]  | [ ]         | [ ]         | [ ]                | [ ]        |
| C4  | Lobby and ready flow are explicit and deterministic         | [ ]  | [ ]         | [ ]         | [ ]                | [ ]        |
| C5  | Match/game can start through intended host-owned transition | [ ]  | [ ]         | [ ]         | [ ]                | [ ]        |
| C6  | Core gameplay loop works for at least one short session     | [ ]  | [ ]         | [ ]         | [ ]                | [ ]        |
| C7  | Post-round or reset flow works where exposed                | [ ]  | [ ]         | [ ]         | [ ]                | [ ]        |
| C8  | No launch-blocking runtime errors in browser/log sink       | [ ]  | [ ]         | [ ]         | [ ]                | [ ]        |
| C9  | UI remains usable on target host and phone sizes            | [ ]  | [ ]         | [ ]         | [ ]                | [ ]        |
| C10 | No brittle runtime hacks in critical gameplay flow          | [ ]  | [ ]         | [~]         | [~]                | [ ]        |
| C11 | Release/content dependencies are validated (where relevant) | [ ]  | [ ]         | [ ]         | [x]                | [ ]        |
| C12 | Game is publicly presentable for v1 without style rewrite   | [ ]  | [ ]         | [ ]         | [ ]                | [ ]        |
| C13 | Explicit ended phase + basic score/result host screen       | [ ]  | [ ]         | [ ]         | [ ]                | [ ]        |
| C14 | Host lobby shell shows QR + join URL + copy/open + start    | [ ]  | [ ]         | [ ]         | [ ]                | [ ]        |
| C15 | Controller shell shows status + avatar + lifecycle actions  | [ ]  | [ ]         | [ ]         | [ ]                | [ ]        |
| C16 | Controller-first lifecycle flow works without host touching | [ ]  | [ ]         | [ ]         | [ ]                | [ ]        |

## Per-Game Records

## `pong`

1. outcome: `pending`
2. automated evidence:
   1. `pnpm --filter pong typecheck && build` passed after the shared shell hook pass (2026-04-08)
   2. `pnpm arcade:test --game=pong` boot smoke reached server/platform ready on local Arcade (2026-04-07)
   3. host lobby now uses `useHostLobbyShell`; controller shell now uses shared status, permissions, and lifecycle-intent hooks
3. manual proof still required:
   1. QR join + controller flow in real phone session
   2. short gameplay, ended-state score screen, and reset validation in Arcade
   3. explicit shell rows `C14` to `C16`

## `air-capture`

1. outcome: `pending`
2. automated evidence:
   1. `pnpm --filter air-capture typecheck && build` passed after the shared shell hook pass (2026-04-08)
   2. `pnpm arcade:test --game=air-capture` boot smoke reached server/platform ready on local Arcade (2026-04-07)
   3. controller no longer ships a duplicate legacy lifecycle/header path beside the shared shell route
3. manual proof still required:
   1. QR join + controller flow in real phone session
   2. short gameplay, ended-state score screen, and reset validation in Arcade
   3. explicit shell rows `C14` to `C16`

## `code-review`

1. outcome: `pending`
2. automated evidence:
   1. `pnpm --filter code-review typecheck && build` passed after the shared shell hook pass (2026-04-08)
   2. `pnpm arcade:test --game=code-review` boot smoke reached server/platform ready on local Arcade (2026-04-07)
   3. controller fullscreen forcing is removed; defend control now releases on mouse leave
   4. host lobby and controller shell now both consume the shared shell contract hooks/components
3. manual proof still required:
   1. QR join + controller flow in real phone session
   2. short gameplay, ended-state score screen, and reset validation in Arcade
   3. explicit shell rows `C14` to `C16`

## `last-band-standing`

1. outcome: `pending`
2. automated evidence:
   1. `pnpm --filter last-band-standing typecheck && build` passed after the shared shell hook pass (2026-04-08)
   2. `pnpm arcade:test --game=last-band-standing` boot smoke reached server/platform ready on local Arcade (2026-04-07)
   3. `pnpm --filter last-band-standing songs:validate -- --output /tmp/airjam-song-embed-report.json` passed with `77/77` embeddable and zero duplicate IDs
   4. `/youtube-test` is debug-gated and excluded from default production assets
   5. host lobby and controller shell now consume the shared shell contract hooks/components
3. manual proof still required:
   1. QR join + controller flow in real phone session
   2. host-owned round start/reset, ended-state scoreboard visibility, and multi-player round flow validation
   3. explicit shell rows `C14` to `C16`

## `the-office`

1. outcome: `pending`
2. automated evidence:
   1. `pnpm --filter the-office typecheck && build` passed after the shared shell hook pass (2026-04-08)
   2. `pnpm arcade:test --game=the-office` boot smoke reached server/platform ready on local Arcade (2026-04-07)
   3. character picker + ready gating + host start flow are now in source and scaffold snapshots
   4. host lobby and controller shell now consume the shared shell contract hooks/components
3. manual proof still required:
   1. QR join + controller flow in real phone session
   2. full match loop timing/task correctness plus ended-state score/earnings summary in couch session
   3. explicit shell rows `C14` to `C16`
