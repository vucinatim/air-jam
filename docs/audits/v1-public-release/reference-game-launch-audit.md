# Reference game launch audit

Date: 2026-09-11
Scope: G6-07; Pong, Code Review, Last Band Standing, The Office, and the
explicitly scoped Air Capture snapshot and Minimal starter follow-ups below.
Evidence level: source contracts and focused executable tests, plus the
integrating agent's explicitly identified local browser lifecycles below. The
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

| Game               | Phone path                                                                                                                                                                            | Semantic path and proof                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code Review        | Join Coder or Reviewer, add an opposing bot or a second player, then Play Match. Touch movement, punches and guard are available immediately; tilt is an explicit opt-in during play. | `player:join_team` with `team1`; `player:set_bot_count` with `{"team":"team2","count":1}`; `player:start_match`. Expect `matchPhase: playing`. Both teams need an occupant and at least one human. `player:return_to_lobby` provides the normal reset path.                                                                                                         |
| Last Band Standing | Every phone readies up; a ready phone can start the match.                                                                                                                            | Each session invokes `player:set_ready` with `true`; inspect `lobby.canStartMatch`; invoke `player:start_match`. Expect `phase: match-countdown`, then `round-active`. Read `round.options` before `player:submit_guess`. Use `player:reset_lobby` to reset. Metadata recommends 2–10 players, while the current runtime also permits a one-player development run. |
| The Office         | Every phone picks an available coworker, then any phone starts the shift.                                                                                                             | Each session invokes `player:select_character` with an id from `lobby.availablePlayers` (for example `spela`). Compare selected controller ids with `runtimeSnapshot.players`; invoke `player:start_match`. Expect `phase: playing`. `player:return_to_lobby` and `player:restart_match` remain available.                                                          |

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

#### 2026-09-12 current-source Pong controller refresh proof

The in-app browser joined local room `4SG8` through the phone-facing LAN URL,
without an extra controller capability in the URL. Real controller UI set the
name `Reconnect proof`, joined Solaris, added one opposing bot and started the
match. The canonical semantic CLI attached without owning/replacing development
processes and read the authoritative store before and after controller reloads.

- Lobby refresh retained exactly the same player identity, profile, team and
  front-paddle assignment. No extra player was created.
- In-match refresh retained the same assignment and `matchStartedAtMs`
  (`1789242829642`). The score progressed from 0:1 to 0:4 while the same match
  continued; this is not a claim that gameplay pauses during disconnection.
- The unified stream recorded `controller.resume.accepted` for the same player.
  The controller returned to its active-paddle UI. The bot subsequently won
  0:5 normally.
- A fullscreen prompt interrupted each reload despite an earlier `Not now`.
  The corrected prompt remembers acknowledgement in session storage, including
  dismissal and fullscreen attempts. Browser reload then returned directly to
  the controller with no prompt and no captured controller console errors.
  Storage denial retains a usable mounted-session fallback; it cannot promise
  reload persistence when the browser refuses storage. Eleven focused tests
  cover this behavior, rejection, remount and server rendering; scoped lint and
  source-plus-test TypeScript pass. The source changed gate passed in 6.00 seconds
  (above the five-second warm target). The normal platform TypeScript root
  excludes tests, so explicit test-root checking remains separate evidence.

The same proof found a separate shell/game input ownership defect (subsequent
local correction below):
the platform emits Arcade `{vector, action}` input while waiting for its game
controller URL after reconnect. The server already routes ordinary input to
Pong, which correctly rejects the missing `direction`. The host log recorded
the warnings; controller-console silence does not mean the whole runtime was
warning-free. Checking only whether the local surface has hydrated would still
allow a delayed menu packet to cross a game-launch transition.

The selected production-valid correction was to send navigation and confirmation through
the existing master-only `airjam.arcade.*` action route. Preserve joystick
threshold crossings and press/release behavior; the host must validate the
current browser surface and epoch and retain selection bounds and exit cooldown.
Remove the shell's continuous input publisher, host polling and obsolete held-
input bookkeeping together. Keep gameplay input and game schemas unchanged.
Prove stale-epoch/late-packet rejection, one movement per stick activation,
release/repress, no automatic relaunch and the real refresh flow before closure.
This is not a new transport, moderation system or agent reasoning policy.

This remains desktop-browser/LAN development evidence, not physical-phone,
final hosted-candidate or production proof. The semantic session returned the
game to its lobby and closed; broker status confirmed zero active sessions.
Both owned test tabs closed, leaving the user's original homepage tab intact.

#### 2026-09-12 menu/game input separation

Menu navigation and confirmation now use the existing master-only Arcade RPC
route with strict semantic payloads and a browser epoch. Gameplay input schemas
and routing are unchanged. The controller's 16 ms publisher, host polling loop,
raw Arcade input schema, and held-input launch-block flag are removed together.
The host checks current surface identity, player membership, launch admission,
selection bounds and exit cooldown. Host-local transitions use one synchronous
reducer update so back-to-back commands cannot observe the previous selection
or admit two concurrent launches before React renders.

Focused evidence: 15 SDK protocol tests, eight controller gesture/lifecycle
tests, 25 host/config/runtime tests, and 11 server routing tests pass. These
cover malformed and stale commands, game-surface isolation, held controls,
fresh retries, lost pointer-up during surface removal, grid wrapping and rapid
commands. The server regression observes both destinations before sending:
menu commands reach only the master, while ordinary RPC and Pong-shaped input
reach only the active child. Scoped lint and explicit source-plus-test
TypeScript pass. The changed gate correctly requests the batch gate for public
SDK changes; it is not reported as a five-second changed-gate pass.

Contract: [Arcade menu command ownership](../../contracts/arcade-surface-contract.md#menu-command-ownership).

The complete Node 24 `pnpm --silent run repo -- check batch` passed on this
working tree (including 205 server, 295 SDK and 567 platform tests). Explicit
PostgreSQL/browser opt-ins remain skipped in that ordinary batch; it is not a
replacement for their separately retained proofs. The generated-source check
also passed after the contract documentation changed.

Final in-app-browser proof used a fresh local room `2M23` after SDK rebuilds
settled. Earlier room `2CVT` was affected by development hot reload and active-
host reconnect rejection during those rebuilds; its interrupted game state is
not used as reconnect evidence. Both trials were owned local test sessions.

In `2M23`, the phone remote launched Pong, joined Solaris, added an opposing
bot and started a first-to-11 match. The semantic CLI attached without owning
processes. Phone reload preserved the same player/front-paddle assignment and
`matchStartedAtMs: 1789244277202`; the same playing match advanced from 0:1 to
0:4. The phone returned directly to its active-paddle UI without a fullscreen
prompt or captured controller errors. Unified logs recorded resume acceptance
and no menu-shaped `Invalid input` warnings. A separate initial pre-join state-
sync request was rejected as unauthorized; this does not claim a warning-free
startup stream. Host browser Back returned both surfaces to the menu without
automatic relaunch, and a fresh phone confirmation launched a new Pong lobby
at epoch 4. The semantic sessions and all owned test tabs closed; only the
user's original homepage remained open.

This closes the reproduced menu/game input leak locally, not the entire
`G6-07` item. Physical-phone and final hosted-candidate proof, the remaining
reference-game checks below, and reviewed delivery remain open. No merge,
deployment, new transport, or game input API change was performed.

#### 2026-09-12 touch controls and interrupted-input proof

Code Review's previous buttons only covered combat; movement required gyro.
Joining a team also requested motion permission, and a rejected permission
promise was unhandled. The controller now starts with four direction buttons,
left/right punches and guard. Enable tilt is an explicit gameplay action;
denial, rejection or unavailable motion leaves the complete touch path usable.
Use touch cancels pending permission activation. Sensor listeners belong only
to foreground gameplay, and interruptions neutralize input without resetting
punch cooldowns. No game rules, input schema or transport changed.

In local room `CPUL`, real controller UI joined Coder, added a Reviewer bot,
started play without a motion prompt, paused/resumed and returned to lobby.
The complete controls fit 844×390 landscape and 390×844 portrait rotation.
Controller console inspection found no errors. This is layout/lifecycle proof;
permission denial and motion mapping were tested with simulated sensor APIs,
not physical phone hardware. No combat balancing or movement-distance result
is inferred from these screenshots.

Office's pad previously interpreted axis-aligned screen bounds and retained
held input across some interruptions. Its game-local input hook now uses three
pad corners to recover local axes after rotation/scaling, preserves the drag
and neutral-center behavior, and gives each control one pointer owner. Active
gameplay owns the hook lifetime: pause, disconnect, death, match replacement
and leaving play discard held controls. WORK also supports keyboard hold/release.
This replaces the old input path rather than adding a second framework control.

In local room `ZQYH`, the phone UI selected Špela, started a shift, exercised
the pad and WORK, and returned to the lobby. At 844×390 a held up press
highlighted up; at 390×844 the rotated right arrow highlighted the matching
local direction. Browser pointer presses/releases used the browser input
pipeline, not JavaScript-dispatched iframe events. Pausing with a pointer
held, then resuming before release, returned to an unhighlighted neutral pad.
Screenshots confirmed both layouts fit. Low-contrast header pause/lobby icons
and selection text were corrected and the header rechecked visually.
No controller console errors were captured. This proves control presentation
and local input lifecycle, not Office task completion or physical-device feel.

Both rooms recorded one initial unauthorized pre-join state-sync request in
the unified server stream; neither run is described as warning-free startup.
All owned test tabs closed and the viewport override was reset. The user's
original homepage was preserved. No merge or deployment occurred.

Validation: all **78 tests** across Code Review (41) and Office (37) pass,
including **48 new controller tests**. They cover direction mapping, rotated
pad geometry, pointer ownership, keyboard actions, permission failure/cancel,
foreground interruption, neutral reset and cooldown preservation. Scoped lint,
source typechecking and explicit test-root typechecking pass. The two-game
source changed gate took **3.414 seconds**, within the warm five-second target.
The earlier whole-repo batch predates these controller edits; this scoped
evidence does not replace the required coherent-batch check before push.

Export parity is also verified. Both game manifests now explicitly declare
`jsdom` as a development dependency: the monorepo's optional Vitest peer had
masked that requirement for the new controller tests. Canonical template
generation refreshed the Code Review and Office archives; source-parity and
content checks pass. Code Review's metadata now describes touch controls with
optional tilt, rather than implying that motion hardware is required.

Fresh temporary scaffolds for both games passed installation, CLI discovery,
server log startup/restart, typecheck, lint, all 41/37 tests respectively, and
production builds through:

```bash
pnpm --filter create-airjam templates:generate
pnpm --filter create-airjam templates:check
pnpm --filter create-airjam smoke:workspace -- --template=code-review
pnpm --filter create-airjam smoke:workspace -- --template=the-office
```

These Node 24 runs installed each game's declared third-party dependencies
outside the monorepo while linking the local Air Jam package graph. They prove
template export and dependency completeness, not an independently published
npm candidate. The smoke runner removed its disposable projects afterward.

#### 2026-09-12 Office live controller refresh

An owned local Arcade room `HYDP` ran one browser phone controller and one CLI
controller. Real phone UI selected Špela and started the shift after the CLI
player selected Žiga. A full phone reload returned directly to Špela's gameplay
controls without another fullscreen prompt or coworker selection. Authoritative
CLI reads before and after retained the same two-player roster, phone identity
`Cmtyvh9j92QN36EDNSAWLETTF2XPUG`, character assignments, playing phase, Arcade
epoch `2`, and game `lifecycleVersion: 1`. Store revision advanced from `7` to
`47`; energy continued from `92` to `12` rather than resetting to `100`.
No controller console errors were captured. Phone return-to-lobby succeeded,
the semantic session and both owned browser tabs closed, and the user's
original homepage was preserved. No development process was replaced.

The subsequent complete Node 24 `pnpm --silent run repo -- check batch` passed
on the current launch-experience working tree, including the new controller
source and corrected report-migration verification declarations. Generated
sources, workspace types, lint, canonical guards, 225 repo-contract tests,
205 server tests, 295 SDK tests, 567 platform tests and the intervening package
suites passed. The ordinary run skipped 41 server and 115 platform opt-in
database cases; the separately retained database/browser/game-scaffold proofs
are not inferred from that run. This is combined launch-branch evidence, not
validation of the still-separate host-authority branch or an immutable release
candidate. No code was committed, pushed, merged or deployed.

This proves refresh continuity against the running local host after the new
controller changes. It does not prove physical-phone motion/feel, Office task
completion, a prolonged network outage, or the final hosted candidate.

#### 2026-09-12 Office simulation no longer depends on first input

The refresh run exposed a separate correctness issue: the browser player's
energy decayed while the CLI player's stayed at `100`. In a second live room
(`7PRB`), a CLI player selected Špela and started a real shift without sending
input; the host timer/tasks advanced but player stats remained `100/100`.
The host loop returned early on missing input before advancing that player's
stats, task progress/completion and breaks.

The correction separates player intent from host-owned time: only movement
and new WORK presses require an input sample. Every spawned participant still
receives normal timed updates; pause still stops the entire simulation. Energy
rates, tasks, room lifecycle, transport and input schema are unchanged.
No new game loop, default-input publisher or agent-specific behavior was added.

Focused regression tests failed before the correction for silent-player decay,
task progress and coffee progress. All five now pass, including pause and
single match completion after all silent players die. They exercise the real
host hook and TaskManager with store/audio/UI boundaries mocked. All **42
Office tests**, explicit test-root types, scoped lint, and the source changed
gate (**3.052 seconds**) pass.

A fresh post-fix host (`L8FR`) independently confirmed the semantic CLI path:
selection/start actions, no input packets, energy `100 → 70 → 2 → 0`, then
`matchPhase: ended`, `gameOver: true`, and `alive: false` at store revision `54`.
The real host rendered SHIFT ENDED with the expected task penalty; no captured
host console errors or room error logs occurred. Owned CLI sessions and host
tabs closed without replacing the development stack. The Office scaffold
archive and its source-parity manifest were regenerated and verified.

`pnpm --filter create-airjam smoke:workspace -- --template=the-office` then
created a fresh temporary project outside the monorepo. Installation, CLI
discovery, server log startup/restart, types, lint, all 42 tests and the
production build passed; the runner removed its disposable project afterward.
This uses fresh declared third-party dependencies with linked local Air Jam
packages, not independently published registry artifacts.

The earlier complete launch-branch batch predates this narrow runtime fix;
the focused and live proofs above are the subsequent evidence. Physical-phone
task interaction and final hosted-candidate proof remain open. No commit, push,
merge or deployment was made.

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
3. Check Code Review's actual mobile motion permission and touch fallback on
   physical devices; local browser and simulated-permission coverage is above.
4. Check Last Band Standing's audible YouTube playback under real browser
   autoplay restrictions. Existing embed-error handling skips known broken
   clips, but store tests cannot prove playback or third-party availability.
5. Confirm Office's movement feel and task completion on a physical phone.
   Local rotated layout and interrupted-gesture proof are retained above.

Do not classify all reference-game experience proof as complete from these
source checks alone.

## 2026-09-12 Minimal starter activation and catalog identity

Minimal is the clean-slate creator template, not a full party-game offering.
This bounded G6-07 pass corrected two concrete defects without introducing a
new interaction or runtime system:

1. Its native TAP button handled only pointer-down. In browser room `FMJX`,
   one pointer click incremented the count to 1, but focused Enter and Space
   left it at 1. Switching the existing handler to `onClick` gives the button
   native mouse/touch/keyboard activation. After the change, actual browser
   click, Enter, and Space independently produced 1, 2, and 3. Controller
   refresh retained the same identity, personal count 3, and shared count 3.
   Three regression cases failed before the fix and passed afterward; they
   inspect the actual component's native click callback, exactly-once dispatch,
   absence of a duplicate pointer handler, and disconnected/connecting guards.
   They add no test dependencies. All seven Minimal tests passed in 800 ms;
   scoped lint/typechecks passed and the source changed gate took 4.439 seconds.
2. The workspace launcher already emitted Minimal's URLs, but the local Arcade
   catalog omitted Minimal and silently fell back to Air Capture. This was more
   than a wrong label: a semantic session attached to `FMJX` discovered Air
   Capture actions for the running Minimal game. No mismatched action was
   invoked. Adding Minimal to the existing catalog/configuration pattern fixes
   its name, route, template/source links, and runtime identity. Eleven focused
   catalog tests pass, including three red-before/green-after cases, all-game
   manifest parity, literal Next client environment reads, direct resolution,
   independent host/phone URLs, and production invisibility. Scoped source/test
   TypeScript and lint pass; the source gate passed in 9.729 seconds, above its
   five-second target.

Fresh browser room `V69B` displayed **Play Minimal** and launched
`/arcade/local-minimal` with `local-reference-minimal` identity. CLI session
`eab04ce8-796b-45fa-92cf-b6dd3d439110` discovered only `player:tap` and
`player:reset_counter`. Both were host-acknowledged: tap committed count 1,
then reset committed count 0 with an empty per-player map. The printed LAN
controller path loaded the correct game; real click/Enter/Space produced count
3 for browser controller `Cmtywcurd2YJ69HSQFYATGT9N6LDAV`, independently
confirmed by the CLI's authoritative snapshot with `lastError: null`.

The canonical scaffold generator/check passed. A fresh Minimal project outside
the monorepo passed dependency installation, CLI discovery, server logging
startup/restart checks, typecheck, lint, all seven tests, and production build
through `pnpm --filter create-airjam smoke:workspace -- --template=minimal`
(terminal exit 0). Air Jam packages were workspace-linked; this is not an exact
published-candidate installation proof.

**Remaining local-preview gap:** a controller opened at `http://localhost:3000`
stayed at the existing "Still loading" recovery screen when embedding the
correct `http://192.168.0.33:5173` LAN runtime. Direct LAN runtime navigation
and the printed LAN platform/controller URL both worked. The unified stream
retained an iframe bridge attachment timeout for controller
`C1ca6aa2991594aa2ac3f79122fc66ae2` at `21:27:17Z`; it did not establish the
browser-level reason. A fresh diagnostic room `DBRN` subsequently captured
the exact iframe document request through the in-app browser's CDP capability:
`Network.loadingFailed` reported `net::ERR_BLOCKED_BY_CLIENT`,
`blockedReason: other`; its matching request reported `mixedContentType: none`.
The request was rejected by the browser client before a response, not an Air Jam
HTTP error. This does not identify which client policy caused the rejection.
Keep it classified as an unresolved in-app-browser cross-address limitation;
do not claim a product fix or weaken CSP/sandbox/network permissions. The
printed LAN join path remains the passing local browser proof. No
physical-phone, hosted-candidate, merge, or deployment proof is claimed here.

The same pass also found validation interference at `21:25:27–29Z`: the fresh
scaffold smoke rebuilt shared SDK outputs while the owned dev stack was live.
Its clean build briefly removed source maps and triggered
`AJ_MISSING_SESSION_PROVIDER` during hot reload. These errors were induced by
the validation workflow; fresh runtime pages subsequently loaded and passed the
checks above. The source confirms smoke rebuilds SDK/server/MCP/CLI before
workspace-linking them into the temporary project, while normal SDK dev uses
`tsup --watch --no-clean`. The existing build freshness helper cannot coordinate
those raw builds with the watcher. The resolution is sequencing, not new
runtime code: follow the [separate build/dev ownership guidance](../../working-agreements.md#development-check-layers)
for subsequent smoke runs. Do not describe the whole historical dev log as
error-free or rerun the already-passing smoke just to erase this evidence.

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
