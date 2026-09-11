# Reference game launch audit

Date: 2026-09-11
Scope: G6-07; Pong, Code Review, Last Band Standing, The Office, and the
explicitly scoped Air Capture snapshot follow-up below.
Evidence level: source contracts and focused executable tests, plus the
integrating agent's explicitly identified local Pong lifecycle below. The
source-audit subtask did not operate the browser, restart the shared dev stack,
or verify production.

## Air Capture snapshot follow-up

Air Capture's `canStartMatch` projection now requires a ready lobby, matching
the authoritative reducer. Countdown, playing, and ended snapshots no longer
advertise initial start as available. No gameplay, action, or team-readiness
rule changed. Five new snapshot cases cover all four phases and an unready
lobby; all 88 Air Capture tests, typecheck, and lint passed. The bundled
scaffold archive was regenerated through the canonical generator and checked
for source parity. This is focused semantic proof, not a new browser,
physical-phone, or hosted-release run.

## Findings and changes

The normal controller interfaces already support starting all four games.
No new launch UI or orchestration system was needed. The concrete problems
were inconsistencies between those interfaces and their game actions.

| Game               | Concrete problem                                                                                                       | Resolution                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Code Review        | `startMatch` could enter play with no human or opposing team, bypassing the displayed readiness rule.                  | Use the existing readiness function on current connected assignments at the authoritative start boundary. Only start from the lobby; existing rematch UI still returns to the lobby first. |
| Code Review        | Agent `award_point` was advertised as a participant action, but the store correctly accepts it only from the host.     | Advertise `host:award_point`; retain host-only scoring authority.                                                                                                                          |
| Last Band Standing | Any ready player could start while another lobby player was unready, despite both interfaces requiring everyone ready. | Require the complete lobby roster to be ready before starting, including host-triggered starts.                                                                                            |
| The Office         | `startMatch` could skip coworker selection or reset an already-running shift.                                          | Initial start requires lobby phase and a selection for every connected controller. Existing separate rematch behavior is unchanged.                                                        |
| The Office         | Agent snapshot claimed `canStartMatch` from one selection without knowing the full connected roster.                   | Report the narrower truthful `hasCharacterSelections`; explain that the agent must compare selections with the session's runtime player roster. No duplicate replicated roster was added.  |

Authoritative sources:

- [Code Review reducers](../../../games/code-review/src/game/stores/code-review-store-state.ts), [store actions](../../../games/code-review/src/game/stores/code-review-store.ts), [agent contract](../../../games/code-review/src/game/contracts/agent.ts), and [existing readiness rules](../../../games/code-review/src/game/domain/match-readiness.ts).
- [Last Band Standing actions](../../../games/last-band-standing/src/game/stores/create-store.ts), [agent contract](../../../games/last-band-standing/src/game/contracts/agent.ts), and [controller readiness](../../../games/last-band-standing/src/controller/hooks/use-controller-lobby-state.ts).
- [Office reducers](../../../games/the-office/src/game/stores/space-store-state.ts), [agent contract](../../../games/the-office/src/game/contracts/agent.ts), and [host readiness](../../../games/the-office/src/host/hooks/use-office-host-session.ts).

The integrating agent's Pong run found two additional concrete issues:
`canStartMatch` remained true during playing/ended phases, and the scoring
action accepted controller calls. [Pong's agent contract](../../../games/pong/src/game/contracts/agent.ts)
now limits readiness to the lobby and advertises `host:award_point`;
[the store](../../../games/pong/src/game/stores/pong-store.ts) now rejects
non-host score mutations. Normal controller join/start/restart controls are
unchanged. Tests prove that a controller cannot award itself points during
play while the host can.

## Human and agent launch paths

All games publish their agent contract through `src/airjam.config.ts`.
`airjam session open` returns discoverable actions, and `session read` returns
the game snapshot and runtime player roster. Use `session invoke` for semantic
actions, `session input` for continuous gameplay input, and `session close`
when finished. The agent does not need to click a host-only Start button.

The examples below attach to an already running Arcade room with the named
game launched. Do not use these commands to replace a stack owned by another
agent. Substitute the room and returned session id.

```bash
node packages/cli/dist/index.js session open --dir . --game code-review --mode arcade-dev --room ROOM
node packages/cli/dist/index.js session read SESSION --dir .
node packages/cli/dist/index.js session invoke SESSION player:join_team --payload team1 --dir .
node packages/cli/dist/index.js session invoke SESSION player:set_bot_count --payload '{"team":"team2","count":1}' --dir .
node packages/cli/dist/index.js session invoke SESSION player:start_match --dir .
node packages/cli/dist/index.js session close SESSION --dir .
```

| Game               | Phone path                                                                                                                                                | Semantic path and proof                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code Review        | Join Coder or Reviewer, add an opposing bot or a second player, then Play Match. Motion permission is requested when joining; button controls also exist. | `player:join_team` with `team1`; `player:set_bot_count` with `{"team":"team2","count":1}`; `player:start_match`. Expect `matchPhase: playing`. Both teams need an occupant and at least one human. `player:return_to_lobby` provides the normal reset path.                                                                                                         |
| Last Band Standing | Every phone readies up; a ready phone can start the match.                                                                                                | Each session invokes `player:set_ready` with `true`; inspect `lobby.canStartMatch`; invoke `player:start_match`. Expect `phase: match-countdown`, then `round-active`. Read `round.options` before `player:submit_guess`. Use `player:reset_lobby` to reset. Metadata recommends 2–10 players, while the current runtime also permits a one-player development run. |
| The Office         | Every phone picks an available coworker, then any phone starts the shift.                                                                                 | Each session invokes `player:select_character` with an id from `lobby.availablePlayers` (for example `spela`). Compare selected controller ids with `runtimeSnapshot.players`; invoke `player:start_match`. Expect `phase: playing`. `player:return_to_lobby` and `player:restart_match` remain available.                                                          |

Pong uses the same team-join/opposing-bot/start semantic recipe as Code Review,
and also exposes `player:restart_match` from the ended phase.

Host-only staging actions remain host-only: Pong and Code Review `host:award_point`,
Last Band Standing `host:force_game_over`, and Office `host:finish_match`.
An attachment to someone else's host is not a grant of host staging authority.

## Reconnect and remaining live proof

### Local Pong lifecycle observed by the integrating agent

In room `WQHR`, two CLI controllers joined opposite teams and controller-driven
start was accepted. The actual host simulation finished 5–4 after 39,593ms of
simulation time; the other controller observed the same ended-match summary.
Controller restart returned to playing, then controller return-to-lobby reset
scores to 0–0 while preserving both assignments. Closing both sessions removed
their roster entries; the host lobby was clean, without browser error logs.

This proof predates the Pong score-authority/readiness correction above. It
does not substitute for physical-phone, autoplay, or production validation.

### Local Last Band Standing controller pass

Room `T9N9` launched through the normal `pnpm run dev -- --game=last-band-standing`
front door. A browser controller connected through the LAN URL. At 390×844,
the category grid and ready/start controls were visible. Actual button clicks
readied the player, started round one, submitted an answer, showed an incorrect
answer/result with the correct artist, and returned to the lobby. This is a
one-player development run, not the advertised multiplayer or physical-phone
proof. No browser errors were observed. The YouTube iframe was present, but
audible playback was not verified.

The CLI attachment exposed an independent helper bug: game inspection used the
game's TypeScript configuration, while snapshot projection used the monorepo
directory and could not resolve the game's valid `@/…` imports. The shared
helper now resolves from the authored config directory for every operation.
Relative-import and project-alias regression fixtures exercise inspect/read/invoke;
the game's imports and public contract were not rewritten to work around it.

After rebuilding the helper and restarting only the empty session broker, the
same room passed a mixed two-player run. The CLI reported one of two players
ready with `canStartMatch: false`; a real phone-UI click readied the second player.
CLI start committed `match-countdown` with both players active. CLI answer
submission was observed in authoritative state; the browser player answered the
same round and the result screen showed both scores (311 and 241). CLI reset
returned to lobby and the agent session closed cleanly. This directly verifies
the alias correction and shared human/agent ready/start/answer path; it still
does not prove audible playback or a physical mobile browser.

### Local Office semantic pass

Room `ZSTB` launched from the normal development front door and rendered the
Office host without browser errors. The discovered `player:select_character`
action selected `spela`; `player:start_match` committed `phase: playing`.
The validated input lane accepted movement and neutral/release input.
`player:return_to_lobby` committed `phase: lobby`, then the session closed.
This proves the updated selection/start contract against the running host,
not physical-phone controls, task completion, or movement-distance assertions.

### Local Code Review semantic pass

Room `JK6Q` launched without browser errors. A CLI controller joined Coder,
added one Reviewer bot, and started the match through the discovered participant
actions. All three mutations reported committed state updates; readiness changed
to true once the opposing bot existed and back to false in the playing phase.
The session advertised score staging as `host:award_point`, not a player action.
Return-to-lobby committed successfully and the session closed cleanly.
Mobile motion permission and combat feel remain separate experience checks.

### Remaining checks

All three use existing host roster synchronization rather than game-specific
connection machinery. Code Review prunes removed team assignments; The Office
prunes removed character/runtime records; Last Band Standing removes departed
players from the active round and returns to lobby if no active players remain.
These are source observations, not proof of seamless phone reconnect.

Still verify with the integrating agent's real host and controller:

1. Repeat the representative lifecycle against the final hosted candidate,
   including corrected Pong contracts. The local runs above are development
   evidence, not deployment or public-package proof.
2. Refresh or briefly disconnect a phone and confirm the SDK resume lease
   preserves the identity and game experience; distinguish resumed connection
   from an intentionally closed session that leaves the roster.
3. Check Code Review's actual mobile motion-permission and button fallback.
4. Check Last Band Standing's audible YouTube playback under real browser
   autoplay restrictions. Existing embed-error handling skips known broken
   clips, but store tests cannot prove playback or third-party availability.
5. Confirm Office's phone layout and movement/action controls during a shift.

Do not classify all reference-game experience proof as complete from these
source checks alone.

## Validation

Focused store/contract tests:

```bash
pnpm --filter code-review test -- tests/game/stores/code-review-store.test.ts
pnpm --filter last-band-standing test -- tests/game/stores/create-store.test.ts
pnpm --filter the-office test -- tests/game/stores/space-store-state.test.ts
pnpm --filter pong test -- tests/game/stores/pong-store-state.test.ts
```

The tests cover valid controller starts, invalid or incomplete starts,
Code Review's stale disconnected assignment and host scoring authority,
Office's rematch preservation, and Last Band Standing's complete 2-, 6-,
and 10-player match progression. Pong covers scoring authority and readiness
in lobby/playing/ended phases. These four focused files pass 20 tests.
The new test files are also explicitly
typechecked because normal game TypeScript roots exclude `tests/`.

The integrating pass ran all four game test suites together: **111 tests passed**
(Pong 26, Code Review 10, Last Band Standing 55, The Office 20).

The final canonicality review consolidated Last Band Standing's five copies of
start readiness into one plain game-domain predicate shared by the store, host,
controller surfaces, and agent contract. Existing caller authority and playlist
validation remain in place. Its full suite then passed **62 tests**, including
seven predicate cases; source-plus-test TypeScript and changed lint passed.

The affected implementation check passed in 5.145 seconds (three games;
slightly above the five-second warm target); the separate Pong changed check
passed in 3.071 seconds. Source-plus-test TypeScript and changed-test lint
passed for all four games. No full workspace build, browser
process, deployment, or unrelated subsystem was changed for this audit.
