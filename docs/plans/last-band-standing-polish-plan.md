# Last Band Standing Polish Plan

Status: planned  
Created: 2026-04-20  
Scope: `games/last-band-standing`

## Goal

Bring Last Band Standing from "working showcase game" to a more polished party-game experience, with controller flows that behave correctly in Arcade and a host layout that makes the YouTube video, prompt, answers, and player status feel intentional.

This plan is intentionally game-scoped. It should not introduce new SDK concepts unless the implementation uncovers a real framework gap.

## Current Issues

1. Controller lobby UI is still rough.
2. Controller player names do not inherit cleanly from the Arcade/player profile path.
3. The ready/start flow is confusing:
   1. ready should be the primary controller action
   2. start match should appear only after the user is ready
   3. controller-side start match currently does not work
4. The in-game home/back-to-lobby controller action does not work.
5. Host gameplay spacing is cramped around the top/nav separator and the round prompt text.
6. Host gameplay layout wastes the bottom band on a separate player row instead of letting the YouTube stage own the full screen.
7. Host player cards are too small and do not show enough useful round context.
8. Host answer reveal should be centered on the video stage, in the same visual zone as the prompt.
9. Controller game-over leaderboard is not scrollable, so larger rooms can hide players.
10. Song selection is too flat; all songs currently live in one undifferentiated pool.
11. Clips usually start from the same timestamp, making repeat play less varied and making some songs slow to recognize when their intro is empty.

## Assumptions

1. "YouTube iframe to the bottom of the screen" refers to the host gameplay surface, because the YouTube iframe and host player row are host-owned.
2. Controller-specific work in this pass is lobby, ready/start, home/back-to-lobby, and game-over scrolling.
3. Song categories and randomized clip starts are the next gameplay-content pass after the immediate UI/flow fixes.

## Phase 1: Controller Lobby And Flow Fixes

### Name Inheritance

Controllers should inherit the player name from the Arcade/SDK player profile path instead of asking the player to manage a separate name by default.

Desired behavior:

1. if Arcade provides a player name, use it immediately
2. keep any existing local fallback only for standalone/dev cases where no Arcade player profile exists
3. avoid duplicating name state if SDK/store state can be the source of truth

### Ready Button

The ready button should become the main controller lobby action.

Desired behavior:

1. primary button: "Ready" when not ready
2. primary ready state: clear "Ready" / "Waiting" feedback when ready
3. no competing start button before the local player has readied
4. the UI should make the local player's state obvious without extra explanatory copy

### Start Match Button

Once the local player is ready, show the start match action when starting is allowed.

Desired behavior:

1. start match appears after the local player is ready
2. controller-side start match triggers the same canonical game-store action as host start
3. start should be disabled or hidden when the minimum player/ready conditions are not met
4. host and controller start paths should not diverge

## Phase 2: Controller Gameplay Actions

### Home / Back To Lobby

The in-game home button should return the match to the lobby.

Desired behavior:

1. controller home button calls the canonical lobby/reset action
2. host and controller surfaces both observe the same phase transition
3. any active YouTube playback is stopped or muted by the existing phase-driven YouTube adapter
4. returning to lobby leaves the game ready for a clean next match

## Phase 3: Host Gameplay Layout Polish

### Prompt Spacing

Add proper visual spacing between the top/nav separator and the current round prompt.

Desired behavior:

1. "What song is this?" / "What artist is this?" should not feel glued to the top chrome
2. spacing should work at desktop Arcade and smaller scaled host sizes
3. avoid layout shifts during phase transitions

### Full-Height Video Stage

The YouTube iframe should own the full gameplay stage down to the bottom edge instead of stopping above a separate bottom player row.

Desired behavior:

1. video stage fills the available gameplay area
2. player status is overlaid on top of the video stage
3. no opaque full-width bottom bar for players
4. overlays remain readable over blurred/revealed video

### Overlay Player Cards

Replace the current bottom row with larger transparent player cards over the video.

Desired behavior:

1. cards sit in an overlay row, likely near the bottom
2. row itself has no solid background
3. cards use translucent surfaces with backdrop blur
4. cards are larger and easier to scan
5. include useful stats such as:
   1. total score
   2. ready/answered/correct state
   3. last response time when available
   4. streak/fire state if already tracked

### Centered Reveal

The revealed answer should appear centered in the video stage, aligned with the existing prompt zone.

Desired behavior:

1. answer title/artist appears in the center of the video area
2. "correct artist/song" metadata can stay secondary
3. quickest-player feedback should not push the answer away from the center
4. reveal should read clearly while the player cards remain visible

## Phase 4: Controller Game-Over Screen

Make the controller leaderboard scrollable.

Desired behavior:

1. small rooms still look centered and polished
2. large rooms can scroll through all players
3. primary next action stays reachable
4. no clipped content behind mobile browser or Arcade controller chrome

## Phase 5: Song Buckets

Add selectable song buckets in the lobby so the host can shape the match pool.

Initial bucket candidates:

1. Global Pop
2. Meme
3. Slovenian
4. Balkan
5. Rock / Classics
6. Throwbacks

Desired behavior:

1. songs declare one or more bucket IDs
2. lobby exposes bucket toggles
3. at least one bucket must remain selected
4. the match randomizes only from selected buckets
5. the store keeps selected bucket state explicit and deterministic
6. standalone and Arcade modes behave the same

Implementation preference:

1. keep bucket metadata in the song-bank/content layer
2. keep selection state in the game store, since it changes match generation
3. avoid creating a separate content runtime unless the song-bank file becomes genuinely hard to work with

## Phase 6: Randomized Clip Starts

Make song starts more varied while still keeping the game fair.

Desired behavior:

1. each song can keep a curated default start
2. some rounds can start at `0`
3. other rounds can start within a bounded early window, roughly the first minute
4. avoid starting after the recognizable hook if that would make a round unfair
5. generated start timestamps should be part of the round state so host/controller/reconnect behavior stays deterministic

Implementation preference:

1. add per-song optional clip-start metadata if needed:
   1. default start
   2. random start window
   3. excluded intro/unsafe ranges if a song needs curation
2. choose the final start timestamp when the round is created
3. pass that timestamp into the YouTube embed URL instead of deriving it only from the original YouTube URL

## Verification

Run focused checks after implementation:

1. `pnpm --filter last-band-standing typecheck`
2. `pnpm --filter last-band-standing test`
3. `pnpm --filter last-band-standing build`
4. manual Arcade dev pass:
   1. controller joins with inherited name
   2. ready flow works
   3. controller start match works
   4. controller home/back-to-lobby works
   5. host prompt/reveal/player overlay layout is readable
   6. controller leaderboard scrolls
5. if song bucket/random-start work lands in the same pass, run the song validation workflow too.

## Non-Goals

1. Do not move YouTube playback into SDK `MusicPlaylist`; YouTube remains an external-media adapter controlled by SDK music volume.
2. Do not build a full song-management CMS.
3. Do not add broad Last Band Standing architecture churn unless needed to keep the implementation simple.
4. Do not change shared Arcade controller chrome for this game-specific pass.

## Ready To Implement

This plan has enough detail to start implementation. The only assumption to validate during implementation is whether the video/player-row layout request is indeed host-owned; the code structure strongly suggests it is.
