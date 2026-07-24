# Android Auto Road Trip Plan

Last updated: 2026-07-24
Status: active; Goals 1 and 2 complete, Goal 3 in progress
Target: road-trip-ready build for 2026-07-25

Related docs:

1. [Current State](../current-state.md)
2. [Final V1 Release Plan](./v1-release-plan.md)
3. [Framework Paradigm](../framework-paradigm.md)
4. [Release Workflow](../strategy/release-workflow.md)
5. [Working Agreements](../working-agreements.md)

Related repositories:

1. Air Jam: `vucinatim/air-jam`
2. Android wrapper: `domenkoscak/airjam-mobile`

## Purpose

Make Air Jam and Last Band Standing reliable and readable on Domen's Android
Auto setup for a passenger-operated road-trip session, then publish the updated
game through the normal Air Jam release path.

This plan is the live source of truth for the work on 2026-07-24.

It records:

1. what is verified
2. what remains uncertain
3. architectural decisions
4. execution order
5. validation and release gates
6. progress and follow-up discoveries

## Outcome We Want

Passengers can:

1. see Air Jam clearly on the car display
2. join through a deterministic QR flow
3. select and configure Last Band Standing entirely from phones
4. play a complete music-quiz match without touching the car display
5. hear every music clip reliably
6. receive category-correct, unique answer options
7. play from a much larger, well-curated song catalog
8. restart or return to Arcade from controllers

The reliable fallback is a passenger-owned phone, tablet, or laptop acting as
the host display and audio source if Android Auto blocks installation, rendering,
or audio on the day of the trip.

## Execution Goals

Work proceeds through four sequential goals. Each goal must pass its completion
gate before the next one becomes the primary focus.

### Goal 1: Platform-Ready Foundation

Scope:

1. make the public on-screen controller launcher contextual and unobtrusive
2. inspect and, if appropriately bounded, fix embedded Arcade store-domain
   support in semantic game-session tooling
3. validate the local host-grant and explicit Arcade room-capacity fixes
4. measure the connected phone's real safe-area inset and preserve the
   top-center controller menu tear when the value is reliable
5. replace the placeholder Android launcher/Android Auto icon
6. validate the affected platform and mobile paths with tests, builds, browser
   smoke checks, and focused physical-phone checks

Completion gate:

1. the launcher preserves zero-setup discovery without covering gameplay
2. the canonical agent testing lane works cleanly, or any larger remaining
   semantic-tooling limitation is explicitly documented and tracked
3. the connected phone establishes whether the cutout inset is usable
4. the correct Air Jam icon appears in the installed Android build
5. relevant platform and Android quality gates pass

User input: none expected unless the phone requires an unlock or confirmation.

### Goal 2: Last Band Standing Correctness And Results

Scope:

1. add one explicit `quizCategoryId` to every song
2. guarantee four unique same-quiz-category answer options
3. add a curated integer `difficulty` score from 1 through 5
4. make ten-player controller final standings genuinely scrollable
5. build one clean host reveal scoreboard for all-player correctness, response
   time, round points, and cumulative points
6. make selected lobby categories unmistakable
7. validate complete 2-, 6-, and 10-player matches

Completion gate:

1. randomized option generation cannot leak quiz categories or duplicate
   visible answers
2. final standings scroll through every player on supported phone sizes
3. the reveal remains readable without card clutter or host scrolling
4. all game tests, typecheck, lint, build, and multiplayer match proofs pass

User input: none expected for the structural implementation.

### Goal 3: Content And Visual Polish

Scope:

1. review the existing catalog's difficulty distribution
2. prepare a medium/hard song candidate list
3. review the proposed artists and tracks with the user
4. add the approved songs and validate YouTube availability and clip timing
5. polish typography, spacing, sizing, alignment, and long-label behavior
6. run the complete responsive browser matrix and focused physical-phone proof

Completion gate:

1. the default mix has an intentional difficulty curve
2. every new song passes catalog, option, availability, and clip-quality checks
3. lobby, active round, reveal, and game over are visually approved across the
   supported phone and host matrix
4. complete matches pass with 2, 6, and 10 players

User input: required for song taste and final visual judgment.

### Goal 4: Release

Scope:

1. run the final repository quality gates and release doctor
2. validate the hosted candidate with a complete smoke match
3. present the release candidate and remaining caveats to the user
4. publish only after explicit user approval
5. verify the live Arcade and, only if the wrapper/media path changed, run a
   short final car regression

Completion gate:

1. all required automated and manual checks pass
2. no known road-trip blocker remains
3. the user gives an explicit green light
4. the published release passes its production smoke check

User input: explicit release approval is mandatory. Goal 4 must stop before
publication until that approval is received.

## Current Evidence

### Air Jam And Last Band Standing

Verified locally on 2026-07-24:

1. Last Band Standing tests pass: 38/38
2. Last Band Standing typecheck passes
3. Last Band Standing production build passes
4. the hosted-release doctor passes when invoked through the internal
   `create-airjam` source CLI with the game directory explicitly targeted
5. Air Jam's `SurfaceViewport` already owns safe-area, orientation, and
   reference-size scaling
6. Arcade and Last Band Standing already expose controller-owned selection,
   ready, start, answer, restart, and return flows
7. Last Band Standing now has 144 canonical songs across ten independently
   playable categories
8. deterministic validation reports zero catalog issues and 144/144 unique
   YouTube videos accepted by oEmbed
9. Last Band Standing now uses a compact two-column lobby on short landscape
   surfaces and an adaptive player strip for up to ten players
10. the integrated Platform suite passes 156/156 tests, typecheck, focused lint,
    formatting, and a full Next.js production build
11. the Android wrapper runs against the canonical local stack on a physical
    Samsung phone and Google's Android Auto Desktop Head Unit
12. QR join, phone-only game selection, lobby, active play, reveal, game over,
    and restart pass end to end at `800x480`
13. QR, Arcade, lobby, active play, and reveal pass at `1280x720`
14. a ten-controller room passes the compact Arcade, lobby, readiness,
    countdown, and live-round layouts at `800x480`
15. Domen has now completed the real-car media proof: YouTube video renders and
    audible audio plays through the car

### Android Wrapper

Verified from `domenkoscak/airjam-mobile` at commit
`4d34ed85ba3049a5900d16da883cb3584c1d1acf`:

1. the repository is a small Kotlin Android app with one app module
2. its debug APK builds successfully and is approximately 4.4 MB
3. its phone surface is a fullscreen WebView
4. its Android Auto surface declares a navigation app, starts an active
   navigation session, receives a drawable surface, creates a `VirtualDisplay`,
   and renders Air Jam in a WebView
5. the original WebView loaded `https://airjam.io/arcade`
6. JavaScript, DOM storage, wide viewport behavior, and autoplay are enabled
7. the car display is output-only; no car touch or gesture forwarding is
   implemented
8. visible-area changes resize/pad the WebView without reloading it
9. full surface destruction destroys the WebView and can require a room reload
   or reconnect

Implemented and rebuilt locally on 2026-07-24:

1. the WebView now loads `https://airjam.io/arcade?qr=open`
2. the English button-label polling/click injection has been deleted
3. Android for Cars App Library is upgraded from 1.4.0 to stable 1.7.0
4. off-site navigation uses exact-domain/subdomain matching rather than the
   unsafe `endsWith("airjam.io")` check
5. arbitrary host acceptance is limited to debuggable builds
6. the unused location permission and unused AndroidX dependencies are removed
7. WebView console warnings/errors and main-frame load errors are logged
8. focused hostname-policy tests, debug/release APK builds, and Android lint pass

### Domen's 2026-07-24 Proof

Domen reported in Slack that:

1. he got Air Jam running in an app on Android Auto
2. it works while driving on his setup
3. Air Jam opens on the car and the rest of the flow is operated from a phone
4. he wants a larger or explicitly Android-Auto-friendly UI
5. he suggested a URL parameter as a possible presentation contract
6. his car screen is `1920x720`, including the vehicle sidebar

The supplied captures show:

1. Air Jam Arcade rendering inside the Android Auto Desktop Head Unit
2. Air Jam Arcade visibly rendering on the wide real-car surface
3. the six current game cards, including Last Band Standing
4. persistent vehicle/system chrome on the left and overlaid controls on the
   top/right

Evidence classification:

1. real-car Arcade rendering: verified by Domen's report and capture
2. operation while driving: verified by Domen's report, not independently
   reproduced in this workspace
3. physical screen resolution: verified as `1920x720` including the sidebar
4. the exact WebView CSS viewport after system insets is not measured, but is
   covered by testing a conservative range of shorter/narrower viewports
5. Last Band Standing's complete browser/controller lifecycle has now been
   independently reproduced through the local Android wrapper and DHU
6. nested YouTube video playback is independently verified in DHU: active and
   reveal frames rendered and changed across consecutive rounds
7. the DHU opened and closed Android Auto audio streams during playback
8. Domen subsequently confirmed real-car YouTube video and audible audio
   playback, closing the only environment-specific media uncertainty

## Validation Ownership

The car must not become the primary QA environment.

### Air Jam Team Owns

We are responsible for proving:

1. Arcade and game layout at `1920x720`
2. reduced widths that conservatively account for the vehicle sidebar and
   overlays
3. the `800x480` Android Auto minimum landscape
4. QR launch and join behavior
5. all controller-only game selection and lifecycle actions
6. Last Band Standing category and option correctness
7. 2, 6, and 10-player layout behavior
8. complete multiplayer matches
9. restart, return, and reconnect behavior available to browser/WebView
   simulation
10. Android build, WebView configuration, URL validation, and production release
11. hosted Arcade and hosted game behavior

Anything visible, interactive, deterministic, or browser-driven should be
proven before Domen receives the final build.

### Domen Owns

Domen's required proof is complete: the wrapper launches in his car, YouTube
video renders, and audible audio plays.

He is only needed again for a short regression check if we change the Android
wrapper, media integration, or hosted launch contract. Browser validation owns
all normal layout, game-flow, and responsive work from this point forward.

## Important Product Boundary

This is an internal experiment, not official or publishable native Android Auto
support.

The wrapper declares itself as a navigation app so it can draw arbitrary WebView
content on the navigation surface. Official Android Auto games are parked
experiences and are not permitted to remain visible or audible while driving.

For this track:

1. do not market the result as supported Android Auto integration
2. do not attempt to publish the navigation-category workaround
3. do not weaken Air Jam's general architecture around one private wrapper
4. keep a non-car fallback ready for the road trip

## Architecture Decisions

### 1. No User-Agent-Based Android Auto Mode

Responsive layout should react to actual available width and height.

Do not:

1. detect the spoofed desktop Chrome user agent
2. branch framework behavior on Android Auto-specific browser strings
3. add car-only conditionals throughout individual components

### 2. Add One Explicit Presentation Contract

Use one typed, centrally parsed URL contract for intentional car-host launch
behavior.

Proposed initial shape:

```text
?qr=open
```

Do not add a separate car-mode parameter unless implementation uncovers a
specific behavior that cannot be expressed through normal responsive layout.

The contract must:

1. be owned centrally by the Arcade host shell
2. open the QR deterministically without DOM text matching
3. preserve normal behavior when absent
4. be safe to deep-link and test
5. keep layout responsive to dimensions rather than URL flags
6. allow future explicit game selection only after QR persistence is proven

### 3. Controller-Only Operation Is A Hard Contract

The car screen remains output-only.

The following must work from passenger controllers:

1. join
2. select Last Band Standing
3. select song categories
4. ready
5. start
6. answer
7. restart
8. return to lobby
9. return to Arcade

No required flow may depend on clicking the car WebView.

### 4. Fix Quiz Correctness Before Expanding Content

Do not add a large song dump on top of the current selection bugs.

The option-generation and catalog contracts must become strict first so newly
added songs cannot recreate category leakage, duplicate visible options, or
canonical catalog duplication.

### 5. Keep The Song System Simple

Use:

1. one canonical catalog
2. category membership stored directly on each song
3. pure selection functions
4. strong validation

Do not add a CMS or configurable content framework for this one-day track.

## Last Band Standing Baseline Problems

The correctness problems recorded during orientation are now addressed by
Workstream C. The remaining catalog-volume limitation is tracked below and in
Workstream D.

### Category Leakage

Distractors are currently selected from the entire `songBank`, regardless of
the selected song buckets.

Result:

1. a Slovenian answer can receive obvious international distractors
2. players can infer the answer from language/category mismatch
3. selecting a category does not describe the full round option pool

### Duplicate Visible Answers

Forced distractors are inserted before visible-label uniqueness is enforced.

Known example:

1. two different MRFY song IDs can both render as `MRFY`
2. only the correct song ID scores
3. players see two identical buttons with different hidden correctness

The final fallback can also intentionally relax label uniqueness when the pool
is too small.

### Catalog Duplication

Catalog at orientation:

1. 77 rows
2. 70 unique canonical artist/title pairs
3. 7 repeated songs across categories

The expanded catalog now has 144 canonical rows across ten categories:

1. Global Pop: 65
2. Meme: 19
3. Slovenian: 27
4. Balkan: 26
5. Rock / Classics: 25
6. Throwbacks: 53
7. 2000s: 33
8. 2010s: 42
9. Eurovision: 27
10. Dance / EDM: 26

Every visible category can independently supply the default 10-round match and
four distinct title or artist labels.

### Fragile Category Ownership

Category metadata currently lives in a parallel ID map and silently falls back
to Global Pop for an unclassified song.

This allows data and classification to drift.

### Fragile Normalization

Canonical normalization currently removes all characters outside ASCII
`[a-z0-9]`.

Before expanding regional or international content, normalization must retain
Unicode letters and numbers so Cyrillic, Greek, accented, and other titles do
not collapse into empty or incorrect keys.

## Workstream A: Car Launch And QR Contract

- [x] Define the typed car-host query contract
- [x] Parse it centrally in the Arcade shell
- [x] Open the QR from explicit state rather than injected button-text matching
- [ ] Preserve QR visibility when a game auto-launches
- [x] Keep the normal Arcade URL behavior unchanged
- [x] Add focused parsing and behavior tests
- [x] Update the Android wrapper to use the explicit URL
- [x] Remove the English-text polling/clicking injection
- [ ] Test a conservative viewport range that remains valid without requiring
      the exact post-inset car CSS dimensions

Done when:

1. the wrapper can load one documented URL
2. the QR opens deterministically
3. no DOM label scraping is required
4. a passenger can join an empty room without car-screen input

## Workstream B: Responsive Arcade And Game UI

Primary real-car target:

1. physical screen: `1920x720`
2. persistent vehicle sidebar included in that measurement
3. actual safe content viewport to be measured

Regression targets:

1. `800x480` Android Auto small landscape
2. `1280x720` landscape
3. `1600x720` and `1800x720` sidebar/inset simulations
4. `1600x900` standard Air Jam host reference
5. existing phone controller viewports

### Arcade

- [x] Ensure the room/header controls remain readable without covering game
      cards
- [x] Make the game grid use the wide, short surface more effectively
- [x] Ensure game cards do not hide behind system/sidebar overlays
- [x] Ensure the QR overlay fits both width and height
- [x] Ensure controller count and shell controls remain visible
- [ ] Verify resize/visible-area changes do not reload the room

### Last Band Standing Lobby

- [x] Replace the single tall centered stack with a compact short-landscape
      layout
- [x] Use a two-column composition where it reduces vertical pressure
- [x] Make logo size CSS-scaled rather than raw-pixel-sized
- [x] Reduce decorative gaps on short viewports
- [x] Hide secondary help text after players join
- [x] Keep category controls visible and usable
- [x] Make the settings/player region scrollable only where necessary
- [x] Keep start/readiness state visible
- [x] Prove that 1-10 players do not push required controls offscreen

### Last Band Standing Gameplay

- [x] Keep the YouTube stage full-bleed
- [x] Keep round, prompt, timer, and answer status readable
- [x] Replace ten wide bottom cards with an adaptive compact summary
- [x] Keep reveal title/result content above the player strip
- [x] Ensure long artist/title strings do not overflow
- [x] Ensure game-over and restart controls remain visible

Done when:

1. no required content clips at the target sizes
2. the host remains understandable from normal passenger seating distance
3. no layout depends on the Android Auto user agent

## Workstream C: Quiz Correctness And Catalog Contract

- [x] Put `bucketIds` directly on every `SongEntry`
- [x] Delete the parallel song-ID-to-bucket map
- [x] Remove the silent Global Pop classification fallback
- [x] Merge the seven canonical duplicate songs
- [x] Preserve the best URL, timing metadata, and union of categories
- [x] Make round generation receive the eligible selected-category pool
- [x] Freeze that eligible pool for the match
- [x] Reject canonical song duplicates before selection
- [x] Enforce unique visible labels for the current guess kind
- [x] Include a forced distractor only when:
  - [x] it belongs to the eligible pool
  - [x] its visible label differs from the correct answer
  - [x] it does not duplicate another option
- [x] Delete the duplicate-label fallback
- [x] Block match start when four distinct valid labels cannot be produced
- [x] Switch normalization to Unicode-aware letters and numbers

Required tests:

- [x] all options belong to the selected category union
- [x] every round has exactly four unique song IDs
- [x] every round has exactly four unique visible labels
- [x] the correct ID appears exactly once
- [x] forced same-artist pairs cannot create duplicate labels
- [x] catalog song IDs are unique
- [x] canonical artist/title keys are unique
- [x] every enabled category supports the configured match length
- [x] every enabled category has at least four distinct artist labels
- [x] every enabled category has at least four distinct title labels
- [x] Unicode normalization preserves non-ASCII names

Done when randomized generation can run at high volume without producing a
cross-category option, duplicate ID, or duplicate visible answer.

Status: partially complete. Canonical duplication and visible-label duplication
are fixed, and the randomized suite performs 1,000 generation checks. However,
the current option contract scopes distractors to the union of all selected
categories. That is not strict enough when several categories are selected.

Required correction:

1. give every song one explicit `quizCategoryId` used for answer fairness
2. keep `bucketIds` as multi-category lobby/discovery filters
3. construct all distractors from the correct song's `quizCategoryId`
4. validate that all four visible options share that category
5. keep unique ID, unique visible-label, and correct-answer-once invariants

This avoids ambiguous behavior for songs that are simultaneously Slovenian,
2000s, throwbacks, or part of another playlist filter.

## Workstream D: Song Expansion

Road-trip minimum:

1. [x] at least 100 unique canonical songs overall
2. [x] at least 20 Slovenian songs
3. [x] at least 20 Balkan songs
4. [x] every selectable category supports a full default match
5. [x] every selectable category has enough distinct artists and titles for valid
       four-option rounds

Stretch target:

1. 150-200 unique validated songs if quality and embed validation remain green

Priority categories:

1. Slovenian current
2. Slovenian classics
3. Balkan current
4. Balkan classics
5. 2000s
6. 2010s
7. Eurovision
8. Dance / EDM
9. Rock
10. Movie / TV themes
11. Hip-hop
12. Meme / internet

Content rules:

1. [x] prefer songs the group can realistically recognize
2. [x] store explicit curated clip start timing
3. [x] avoid arbitrary intros, silence, skits, or answer-revealing video titles
4. [x] validate YouTube availability through oEmbed
5. [x] do not enable a category until it meets the round/option minimums
6. [x] do not keep the same canonical song as multiple catalog rows
7. [x] document intentional multi-category membership on the one canonical entry
8. [x] classify every song with one explicit answer-fairness category
9. [x] add a curated integer `difficulty` score from 1 through 5
10. [ ] curate a less obvious road-trip mix instead of only increasing volume

Difficulty target for the default mix:

1. approximately 30% difficulty 1-2 anchors
2. approximately 50% difficulty 3 songs
3. approximately 20% difficulty 4-5 songs

The first content pass should rebalance the existing 144 songs before adding a
large second batch. The score is intentionally a small curated scale rather than
a false-precision percentage. It can later power simple easy, balanced, and hard
playlist presets without adding those settings to today's UI. Exact artists and
tracks require a short group-taste review.

The balanced default selector is now implemented. A ten-round match requests
three easy, five medium, and two hard songs. It always prefers unplayed songs,
falls back to other difficulty bands when the selected buckets cannot provide
the requested mix, and only reuses match-history songs after exhausting the
unplayed pool. This makes the default game deliberate without adding settings
or blocking narrow category selections.

### Goal 3 Song Candidate Review

Status: awaiting user review. Difficulty scores are provisional and relative to
this road-trip group. YouTube IDs and clip starts are intentionally deferred
until the tracks are approved, so rejected songs do not create validation work
or catalog churn.

The proposed batch adds 36 songs and brings the validated catalog target from
144 to exactly 180. It emphasizes medium and hard songs while keeping every
candidate recognizable enough to produce a fair reveal.

Slovenian:

- [ ] Dan D — Voda — difficulty 3
- [ ] Koala Voice — Go Disco, Go — difficulty 4
- [ ] Siddharta — Napoj — difficulty 2
- [ ] Big Foot Mama — Led s severa — difficulty 3
- [ ] Niet — Lep dan za smrt — difficulty 3
- [ ] Zmelkoow — Bit — difficulty 3

Balkan:

- [ ] Dino Dvornik — Ti si mi u mislima — difficulty 3
- [ ] Ekatarina Velika — Par godina za nas — difficulty 4
- [ ] Haustor — Ena — difficulty 4
- [ ] Buč Kesidi — Nema ljubavi u klubu — difficulty 4
- [ ] Grše — Mamma Mia — difficulty 3
- [ ] Let 3 — Mama ŠČ! — difficulty 3

2010s:

- [ ] M83 — Midnight City — difficulty 3
- [ ] Tove Lo — Habits (Stay High) — difficulty 3
- [ ] Milky Chance — Stolen Dance — difficulty 3
- [ ] alt-J — Breezeblocks — difficulty 4
- [ ] Portugal. The Man — Feel It Still — difficulty 3
- [ ] Of Monsters and Men — Little Talks — difficulty 3

Rock / Classics:

- [ ] The Strokes — Reptilia — difficulty 4
- [ ] The Cure — Just Like Heaven — difficulty 4
- [ ] Pixies — Where Is My Mind? — difficulty 3
- [ ] Foo Fighters — Everlong — difficulty 3
- [ ] Fleetwood Mac — The Chain — difficulty 2
- [ ] Arctic Monkeys — Fluorescent Adolescent — difficulty 4

2000s and throwbacks:

- [ ] Modjo — Lady (Hear Me Tonight) — difficulty 3
- [ ] The Ting Tings — That's Not My Name — difficulty 3
- [ ] Nelly Furtado — Maneater — difficulty 2
- [ ] MGMT — Kids — difficulty 3
- [ ] Depeche Mode — Enjoy the Silence — difficulty 3
- [ ] Bronski Beat — Smalltown Boy — difficulty 3

Eurovision and Dance / EDM:

- [ ] Go_A — SHUM — difficulty 3
- [ ] Mahmood — Soldi — difficulty 3
- [ ] Daði Freyr — Think About Things — difficulty 3
- [ ] Eleni Foureira — Fuego — difficulty 3
- [ ] Benny Benassi presents The Biz — Satisfaction — difficulty 3
- [ ] Duke Dumont — Ocean Drive — difficulty 4

Candidate source research:

The following metadata is prepared but not yet part of the catalog. All 36
video ids currently return HTTP 200 through the same YouTube oEmbed check used
by the repository validator, none duplicates an existing catalog video, and
none of the canonical artist/title pairs duplicates the current 144 songs.
Clip starts are provisional until playback is sampled after approval.

| Artist              | Song                   | YouTube source                                | Start |
| ------------------- | ---------------------- | --------------------------------------------- | ----: |
| Dan D               | Voda                   | [`rr_x41eIgB4`](https://youtu.be/rr_x41eIgB4) |   52s |
| Koala Voice         | Go Disco, Go           | [`QscWr0JxWrU`](https://youtu.be/QscWr0JxWrU) |   35s |
| Siddharta           | Napoj                  | [`G6whSCaK8gQ`](https://youtu.be/G6whSCaK8gQ) |   51s |
| Big Foot Mama       | Led s severa           | [`ExmoTeC3e5g`](https://youtu.be/ExmoTeC3e5g) |   48s |
| Niet                | Lep dan za smrt        | [`MJZRYU0geOg`](https://youtu.be/MJZRYU0geOg) |   52s |
| Zmelkoow            | Bit                    | [`1HnMi9iYxSs`](https://youtu.be/1HnMi9iYxSs) |   44s |
| Dino Dvornik        | Ti si mi u mislima     | [`pJbOrncVL_Y`](https://youtu.be/pJbOrncVL_Y) |   43s |
| Ekatarina Velika    | Par godina za nas      | [`ooWt0uxF_0I`](https://youtu.be/ooWt0uxF_0I) |   56s |
| Haustor             | Ena                    | [`FmUiX2ml838`](https://youtu.be/FmUiX2ml838) |   43s |
| Buč Kesidi          | Nema ljubavi u klubu   | [`CaZOa3KvfA0`](https://youtu.be/CaZOa3KvfA0) |   49s |
| Grše                | Mamma Mia              | [`QcRbyU6_qB4`](https://youtu.be/QcRbyU6_qB4) |   34s |
| Let 3               | Mama ŠČ!               | [`AyKj8jA0Qoc`](https://youtu.be/AyKj8jA0Qoc) |   42s |
| M83                 | Midnight City          | [`dX3k_QDnzHE`](https://youtu.be/dX3k_QDnzHE) |   44s |
| Tove Lo             | Habits (Stay High)     | [`oh2LWWORoiM`](https://youtu.be/oh2LWWORoiM) |   46s |
| Milky Chance        | Stolen Dance           | [`iX-QaNzd-0Y`](https://youtu.be/iX-QaNzd-0Y) |   45s |
| alt-J               | Breezeblocks           | [`rVeMiVU77wo`](https://youtu.be/rVeMiVU77wo) |   48s |
| Portugal. The Man   | Feel It Still          | [`pBkHHoOIIn8`](https://youtu.be/pBkHHoOIIn8) |   42s |
| Of Monsters and Men | Little Talks           | [`ghb6eDopW8I`](https://youtu.be/ghb6eDopW8I) |   52s |
| The Strokes         | Reptilia               | [`b8-tXG8KrWs`](https://youtu.be/b8-tXG8KrWs) |   35s |
| The Cure            | Just Like Heaven       | [`n3nPiBai66M`](https://youtu.be/n3nPiBai66M) |   42s |
| Pixies              | Where Is My Mind?      | [`OJ62RzJkYUo`](https://youtu.be/OJ62RzJkYUo) |   40s |
| Foo Fighters        | Everlong               | [`hq0rZ3IiyWw`](https://youtu.be/hq0rZ3IiyWw) |   42s |
| Fleetwood Mac       | The Chain              | [`xwTPvcPYaOo`](https://youtu.be/xwTPvcPYaOo) |  170s |
| Arctic Monkeys      | Fluorescent Adolescent | [`ma9I9VBKPiw`](https://youtu.be/ma9I9VBKPiw) |   47s |
| Modjo               | Lady (Hear Me Tonight) | [`mMfxI3r_LyA`](https://youtu.be/mMfxI3r_LyA) |   36s |
| The Ting Tings      | That's Not My Name     | [`v1c2OfAzDTI`](https://youtu.be/v1c2OfAzDTI) |   45s |
| Nelly Furtado       | Maneater               | [`b0XqR7SEE1I`](https://youtu.be/b0XqR7SEE1I) |   45s |
| MGMT                | Kids                   | [`DngxJlZSpPo`](https://youtu.be/DngxJlZSpPo) |   28s |
| Depeche Mode        | Enjoy the Silence      | [`aGSKrC7dGcY`](https://youtu.be/aGSKrC7dGcY) |   45s |
| Bronski Beat        | Smalltown Boy          | [`88sARuFu-tc`](https://youtu.be/88sARuFu-tc) |   50s |
| Go_A                | SHUM                   | [`U7-dxzp6Jvs`](https://youtu.be/U7-dxzp6Jvs) |   48s |
| Mahmood             | Soldi                  | [`22lISUXgSUw`](https://youtu.be/22lISUXgSUw) |   54s |
| Daði Freyr          | Think About Things     | [`1HU7ocv3S2o`](https://youtu.be/1HU7ocv3S2o) |   39s |
| Eleni Foureira      | Fuego                  | [`eDSgs6syrgg`](https://youtu.be/eDSgs6syrgg) |   49s |
| Benny Benassi       | Satisfaction           | [`a0fkNdPiIL4`](https://youtu.be/a0fkNdPiIL4) |   30s |
| Duke Dumont         | Ocean Drive            | [`KDxJlW6cxRk`](https://youtu.be/KDxJlW6cxRk) |   54s |

The Niet source is the only candidate not hosted by the artist, label, an
official topic channel, or Eurovision. It is usable according to oEmbed, but it
must be manually playback-checked or replaced before the song is accepted.

Proposed category treatment:

1. every song keeps one explicit answer-fairness category
2. cross-era and cross-genre `bucketIds` remain discovery filters only
3. Let 3 stays answer-fair with Balkan songs even though it can also appear
   under Eurovision
4. a Movie / TV category is deferred because the current alternating
   song-title/artist question contract makes composer questions arbitrarily
   difficult; it fits the proposed follow-up quiz game better
5. a dedicated Hip-hop category is deferred until it has a reviewed minimum
   pack rather than being launched with filler

If the full batch is approved, the projected additions contain three
difficulty 1-2 songs, twenty-four difficulty 3 songs, and nine difficulty 4-5
songs. The complete catalog will remain naturally easy-heavy, but the balanced
selector will produce the intended per-match curve whenever the selected
category pool supports it.

Validation:

- [x] extend catalog validation to cover categories and canonical uniqueness
- [x] validate YouTube IDs are unique where appropriate
- [x] run the embed validator with failure on invalid entries
- [x] review the generated report
- [x] preflight all 36 candidate ids through YouTube oEmbed
- [x] confirm candidate video ids and canonical songs do not duplicate the
      current catalog
- [ ] manually sample every new category
- [ ] manually sample clip start quality

## Workstream E: Android Wrapper Hardening

Keep this bounded to reliability and obvious security issues.

- [x] Upgrade Android for Cars App Library from 1.4.0 to stable 1.7.0
- [x] Rebuild and resolve API fallout cleanly
- [x] Replace `host.endsWith("airjam.io")` with exact-domain/subdomain matching
- [x] Gate `ALLOW_ALL_HOSTS_VALIDATOR` to debug/development builds
- [x] remove unnecessary location permission if it is not required
- [x] replace injected DOM interaction with the explicit Air Jam URL contract
- [x] record WebView console errors useful for device proof
- [ ] verify surface resize preserves the room
- [ ] verify full surface destruction reconnects acceptably
- [ ] document the exact build/install path that worked on Domen's phone/car

Explicit non-goals:

1. Google Play publication
2. presenting the wrapper as a legitimate navigation app
3. broad Android architecture work unrelated to tomorrow's proof

## Workstream F: End-To-End Proof And Release

### Local Validation

- [x] Last Band Standing typecheck
- [x] Last Band Standing tests
- [x] Last Band Standing production build
- [x] song validation
- [x] relevant SDK/platform tests for the query contract
- [x] platform typecheck
- [x] platform tests
- [x] platform build
- [x] canonical/generated artifact checks
- [x] regenerate the Last Band Standing scaffold template archive

### Browser And DHU Proof

- [x] Arcade at `800x480`
- [x] Last Band Standing lobby at `800x480`
- [x] active round at `800x480`
- [x] reveal at `800x480`
- [x] game over at `800x480`
- [x] QR, Arcade, lobby, active round, and reveal at `1280x720`
- [x] game over and restart at `1280x720`
- [x] Arcade, lobby, active round, and reveal at `1600x720`
- [x] Arcade, lobby, and active round at `1800x720`
- [x] QR, Arcade, lobby, and active round at `1920x720`
- [x] QR open/join from an empty room
- [x] 2-controller full match
- [x] 6-controller layout proof
- [x] 10-controller layout proof

### Domen's Final Car-Only Proof

Everything outside this short list is our responsibility:

- [x] open the wrapper in the real car
- [x] start and operate Air Jam from a passenger phone
- [x] confirm YouTube video on the car display
- [x] confirm audible audio through the car
- [x] confirm the setup works in Domen's real-car use

Run another car check only if the wrapper or media path changes.

## Workstream G: Platform And Mobile Follow-Ups

These are Air Jam platform/system concerns discovered during the Android Auto
proof. They should be represented by GitHub issues even when a local fix is
already present, so the cause, contract, and validation remain discoverable.

P0 before release:

- [x] make the on-screen controller launcher contextual and unobtrusive without
      removing it from public Arcade:
  - [x] keep a clear first-visit/demo path for people who want to try Air Jam
        without connecting phones
  - [x] keep the capability visible as part of Air Jam's developer story
  - [x] collapse or relocate it once real phone controllers join or a game is
        actively running
  - [x] never let it cover gameplay, results, or required controls at supported
        host sizes
  - [x] do not depend on hover because touch and car-host surfaces have no hover
- [x] replace the placeholder Android launcher/Android Auto icon with the
      canonical Air Jam mark

P1 platform correctness:

- [x] keep the controller menu trigger top-center but offset it by the published
      top safe-area inset; verify the real computed value on the connected phone
      before considering any alternate placement
- [x] make semantic game-session tooling target Arcade's embedded game store
      domain instead of assuming the default store
- [x] keep local Arcade host bootstrap on the local session path instead of
      requesting the production host-grant endpoint
- [x] set Arcade room capacity explicitly instead of inheriting the former
      eight-player default

P2 investigation:

- [ ] define and test controller disconnect/background behavior when a phone
      sleeps during lobby or countdown
- [ ] verify WebView surface destruction and recreation preserve or reconnect
      the active room cleanly

Decisions:

1. On-screen controllers are both a zero-setup product demo and a visible
   framework capability. Keep them available in public Arcade. Present a clear
   first-visit `Try on-screen controls` affordance when no phone is connected,
   then transition to a compact launcher or shell-integrated control during
   normal phone-based gameplay.
2. The phone camera solution must be safe-area-driven rather than
   device-specific. Preserve top-center placement and consume
   `safe-area-inset-top`; defer alternate placement unless physical-device proof
   shows that the browser does not expose the cutout.
3. No new Android Auto-specific mode is needed for these fixes.

GitHub issues:

1. [Air Jam #34 — make the on-screen controller launcher contextual](https://github.com/vucinatim/air-jam/issues/34)
2. [Air Jam #35 — make the controller menu camera-cutout safe](https://github.com/vucinatim/air-jam/issues/35)
3. [Air Jam #36 — target Arcade embedded store domains](https://github.com/vucinatim/air-jam/issues/36)
4. [Air Jam #37 — keep local bootstrap off production host grants](https://github.com/vucinatim/air-jam/issues/37)
5. [Air Jam #38 — make Arcade room capacity explicit](https://github.com/vucinatim/air-jam/issues/38)
6. [Air Jam #39 — define controller sleep/background behavior](https://github.com/vucinatim/air-jam/issues/39)
7. [Mobile #1 — replace the placeholder launcher icon](https://github.com/domenkoscak/airjam-mobile/issues/1)
8. [Mobile #2 — harden WebView navigation and QR launch](https://github.com/domenkoscak/airjam-mobile/issues/2)
9. [Air Jam #40 — add the documented canonical `pnpm run dev` front door](https://github.com/vucinatim/air-jam/issues/40)

## Workstream H: Last Band Standing Gameplay And UI Follow-Ups

P0 correctness and usability:

- [ ] make the controller final standings region genuinely scrollable with ten
      players while keeping placement and the lobby button visible
- [ ] add `quizCategoryId` and guarantee same-category four-option rounds
- [ ] add explicit selected-state affordances to lobby category controls:
      check icon, stronger contrast, selected count, and `aria-pressed`
- [ ] show a readable all-player round result board on the host during reveal

The host reveal board should replace the tiny always-on player strip during the
reveal phase. It should show:

1. player rank/name
2. correct, incorrect, or no answer
3. response time
4. points gained this round
5. cumulative points

Use a compact grid for larger groups. Do not cram those details into the active
music phase, and do not require scrolling on the car/host display.

P1 polish and content:

- [ ] rebalance typography, spacing, alignment, and visual hierarchy
- [ ] test long player names and long song/artist labels
- [ ] classify the existing catalog on a curated 1-5 difficulty scale
- [ ] review candidate harder songs with the road-trip group's taste
- [ ] add the approved medium/hard catalog batch and validate clip timing

P2 stretch:

- [ ] begin a second quiz game only after this release is published and its
      regression matrix passes

Browser-first responsive matrix:

| Surface                | Sizes                                      |
| ---------------------- | ------------------------------------------ |
| Phone controllers      | `360x800`, `390x844`, `412x915`, `430x932` |
| Small landscape host   | `800x480`                                  |
| Medium landscape host  | `1280x720`                                 |
| Wide car simulations   | `1600x720`, `1800x720`, `1920x720`         |
| Normal host regression | `1600x900`                                 |

For every relevant surface, capture and inspect lobby, active round, reveal, and
game over. Exercise 2, 6, and 10 players, touch/wheel scrolling, long labels,
category selection, duplicate-label invariants, and a complete match.

## Workstream I: Hosted Release

Current operational note:

1. the local production machine session is missing or expired
2. reauthentication against `https://airjam.io` is required before publishing
3. the monorepo game README's direct `pnpm exec airjam` release command is not
   currently the reliable first-party monorepo path

Release sequence:

- [ ] authenticate the Air Jam machine CLI
- [x] run release doctor against `games/last-band-standing`
- [x] bundle the hosted release
- [x] validate the artifact
- [ ] submit the release
- [ ] inspect moderation/check results
- [ ] publish only after checks pass
- [ ] verify the live Arcade resolves the new release
- [ ] verify the car wrapper receives the updated platform/game

## Validation Matrix

| Surface                   |                               Size | Primary proof                |
| ------------------------- | ---------------------------------: | ---------------------------- |
| Domen's real car          |                `1920x720` physical | completed final media proof  |
| Sidebar/inset simulations | `1600x720`, `1800x720`, `1920x720` | wide-car responsive coverage |
| Android Auto DHU small    |                          `800x480` | minimum supported landscape  |
| Android Auto DHU medium   |                         `1280x720` | common landscape regression  |
| Air Jam host reference    |                         `1600x900` | normal desktop/TV regression |
| Phone controller portrait |      SDK reference and real phones | all player interaction       |
| Hosted Arcade             |          responsive iframe surface | release integration          |

For every host size verify:

1. lobby
2. QR
3. category controls
4. readiness/start
5. active round
6. reveal
7. game over
8. return/restart

## Definition Of Done For The Road Trip

Required:

1. Last Band Standing never generates category-leaking distractors
2. Last Band Standing never displays duplicate answer labels
3. Slovenian and Balkan each support a complete default match
4. the catalog contains at least 100 unique validated songs
5. the Arcade and game host surfaces are readable at Domen's measured viewport
6. the QR and entire match lifecycle work without car-screen input
7. a complete production-hosted match passes under our browser and semantic
   automation
8. YouTube video and audible audio pass on Domen's actual setup
9. the updated hosted release is live
10. a fallback non-car host is ready

Optional:

1. reach the 150-200 song stretch catalog
2. split regional/current/classics categories more finely
3. add extra presentation polish
4. begin a second quiz game

## Stop Rules

1. If real-car YouTube audio fails, stop framework contortions and use the
   passenger-device fallback while documenting the device limitation.
2. If updated Android Auto installation fails, preserve the last known working
   APK and continue Air Jam/game work independently.
3. Do not expand the catalog before quiz correctness tests are green.
4. Do not publish a release that has not passed a complete local match.
5. Do not begin the second quiz game until the required road-trip definition of
   done is satisfied.
6. Do not trade normal desktop/TV/controller behavior for one car viewport.

## Stretch: Second Quiz Game

Only start this after the road-trip release is proven.

Preferred direction:

1. reuse the corrected pure option-generation and round contracts
2. keep game-specific content separate
3. preserve host authority and controller-only input
4. avoid extracting a broad configurable quiz framework prematurely

Candidate themes:

1. movies from stills, quotes, cast, or soundtrack clues
2. general trivia
3. geography
4. logos
5. pop culture

The smallest clean next game is likely movie trivia because it can reuse the
same four-option, timed-round, reveal, scoring, and controller lifecycle without
depending on music playback.

## Open Questions

1. Which artists and eras are genuinely medium or hard for tomorrow's group?
2. Should difficulty remain curated into the default mix, or become one simple
   lobby preset after the road trip?
3. Which semantic quiz category should own cross-tag songs when their lobby
   filters overlap?
4. Was Domen's real-car proof run from the same wrapper commit/build that we
   intend to distribute?

## Progress Log

### 2026-07-24 — Orientation

Completed:

1. inspected the Air Jam framework/runtime model
2. inspected Last Band Standing domain, content, UI, tests, and release path
3. reproduced the category leakage cause
4. reproduced the duplicate visible-answer cause
5. counted canonical songs and category coverage
6. built and inspected the Android wrapper
7. reviewed its Android Auto surface, WebView, and lifecycle behavior
8. verified the Last Band Standing test/typecheck/build baseline
9. visually checked the Last Band Standing lobby at `800x480`
10. reviewed Domen's DHU and real-car captures
11. recorded the real-car `1920x720` physical screen target

Decision update:

1. we own all layout, game-flow, multiplayer, controller, browser/WebView, and
   production-release validation
2. conservative `1600x720`, `1800x720`, and `1920x720` tests remove the need to
   depend on the exact post-inset CSS viewport
3. Domen's final checklist is reduced to real-car YouTube video/audio,
   moving-state playback, and switch-away/back behavior

Next:

1. confirm real-car audio and record the actual WebView CSS viewport
2. implement the compact host and explicit QR launch contract
3. expand and validate the song catalog
4. harden and rebuild the Android wrapper
5. run end-to-end proof and publish

### 2026-07-24 — Strict Quiz And Catalog Contract

Completed:

1. collapsed the 77 catalog rows into 70 canonical songs
2. moved category ownership onto each canonical song and removed the parallel
   category map and implicit Global Pop fallback
3. made empty category selection produce an empty eligible pool
4. made canonical and visible-label normalization Unicode-safe
5. moved answer construction into a dedicated pure module
6. scoped every distractor to the selected-category pool
7. made forced distractors conditional on category eligibility and visible-label
   uniqueness
8. removed the unsafe duplicate-label fallback
9. added a match-start preflight for four distinct visible labels
10. added catalog, round-option, and round-integration tests, including 600
    randomized category/guess-kind checks
11. replaced the source-regex validator with authoritative catalog imports and
    added deterministic category, canonical, forced-reference, YouTube-ID, and
    option-capacity checks

Validation evidence:

1. Last Band Standing tests: 37/37 pass
2. typecheck: pass
3. production build: pass
4. focused ESLint: pass
5. Prettier check: pass
6. deterministic catalog validation: 70 songs, 6 buckets, 0 issues
7. remote YouTube validation: 70/70 unique videos accepted by YouTube oEmbed

Remaining limitation:

1. YouTube oEmbed acceptance proves current video availability, not successful
   nested playback or audio routing in the real car
2. Domen's final car-only playback check therefore remains required

### 2026-07-24 — Catalog Expansion

Completed:

1. separated bucket/type definitions, catalog data, catalog validation, and
   answer selection into focused modules
2. replaced randomized clip offsets with an explicit validated
   `clipStartSeconds` field on every song
3. normalized all catalog IDs to lowercase kebab-case and made that a schema
   invariant
4. expanded the catalog from 70 to 144 canonical songs
5. expanded Slovenian from 6 to 27 songs
6. expanded Balkan from 7 to 26 songs
7. added four independently playable categories:
   1. 2000s
   2. 2010s
   3. Eurovision
   4. Dance / EDM
8. made the validator reject any visible category that cannot supply the
   default 10-round match
9. updated playlist tests so every category must produce ten unique songs

Validation evidence:

1. Last Band Standing tests: 38/38 pass
2. deterministic catalog validation: 144 songs, 10 categories, 0 issues
3. remote YouTube validation: 144/144 unique videos accepted by YouTube oEmbed
4. every catalog ID, canonical artist/title key, and YouTube video ID is unique
5. every category has at least 19 songs and at least 18 distinct artists

Still requiring human judgment:

1. manually sample the selected clip positions for musical recognizability
2. confirm actual nested playback and audio routing in Domen's car

### 2026-07-24 — Car Launch, Responsive Hosts, And Wrapper Hardening

Completed:

1. added the exact typed Arcade launch contract `?qr=open`
2. parsed the contract at the Next.js route and applied it at the replicated
   Arcade surface initialization boundary
3. preserved existing QR preference/first-visit behavior for absent or invalid
   query values
4. added nine focused URL parsing and precedence tests
5. made the Arcade header, grid, cards, settings, QR overlay, and exit control
   respond to short-wide capability queries and safe-area insets
6. made the Last Band Standing lobby a two-column short-landscape composition
7. replaced the horizontally scrolling gameplay scoreboard with a wrapping,
   compact ten-player strip that prioritizes rank, name, and points
8. reserved adaptive vertical space for the player strip during countdown,
   active-round, and reveal phases
9. migrated the Android wrapper from DOM polling to
   `https://airjam.io/arcade?qr=open`
10. upgraded Android for Cars App Library to 1.7.0, removed unused permissions
    and dependencies, tightened host navigation, gated debug host acceptance,
    and added useful WebView error logging

Validation evidence:

1. Platform tests: 156/156 pass
2. Platform typecheck: pass
3. Platform focused ESLint and Prettier: pass
4. Platform full production build: pass
5. Last Band Standing tests: 38/38 pass
6. Last Band Standing typecheck, focused ESLint, and production build: pass
7. Android hostname-policy tests: pass
8. Android debug APK: built successfully, approximately 4.4 MB
9. Android release APK: built successfully with host access intentionally
   disabled for non-debug builds
10. Android lint: zero errors; remaining warnings are reviewed and non-blocking
11. all six scaffold template archives regenerated and verified
12. canonical repo guard: pass

Pending proof:

1. finish the wide browser viewport matrix
2. complete the explicit two- and six-controller scenarios
3. Domen still owns only the final audible car audio, moving-state, and
   switch-away/back checks

### 2026-07-24 — Local Android Auto DHU Harness

Completed:

1. installed Google's Android Auto Desktop Head Unit
2. added checked-in `800x480` and `1280x720` DHU configurations to the mobile
   repository
3. added a debug-only Gradle host URL override while keeping release builds
   pinned to production HTTPS
4. made cleartext traffic conditional on an explicit local debug URL
5. added a helper that builds and installs the wrapper, reverses ports
   `3000`, `4000`, and `5173`, and launches the selected DHU profile
6. verified the debug build embeds the local URL and the release build embeds
   the production URL
7. started the canonical local Arcade, server, and Last Band Standing stack
8. confirmed `http://127.0.0.1:3000/arcade?qr=open` responds successfully

Device evidence:

1. physical phone: Samsung `SM-S921B`
2. Android Auto: `17.1.662444`
3. ADB transport, reverse port forwarding, debug APK install, Android Auto
   projection, and DHU connection all pass
4. the phone browser is a real controller; the car WebView remains output-only

### 2026-07-24 — Local DHU End-To-End Proof

Completed at `800x480`:

1. launched the wrapper through Android Auto from a physical phone
2. opened the QR deterministically through `?qr=open`
3. decoded the rendered QR and joined the room from the phone
4. selected Last Band Standing and launched it from the controller
5. readied and started a match without touching the car surface
6. completed all ten rounds with active video, reveal, game over, and restart
7. observed changing YouTube video frames in both active and reveal phases
8. confirmed the DHU opened Android Auto audio streams during playback
9. connected nine semantic controllers alongside the physical phone for ten
   total players
10. rendered all ten players in Arcade, lobby, readiness, countdown, and active
    play without clipping required game controls

Completed at `1280x720`:

1. QR overlay
2. three-column Arcade
3. Last Band Standing lobby
4. active round
5. reveal

Integration defects found and fixed during proof:

1. local Arcade incorrectly requested the production-only
   `/api/airjam/host-grant` endpoint and failed with HTTP 503; development now
   uses the local session path while production retains the endpoint
2. Arcade rooms defaulted to eight players even though Last Band Standing
   supports ten; the Arcade room capacity is now explicitly 16

Important observations:

1. the first ten-player countdown stopped when the physical phone browser became
   hidden as the phone slept
2. with Android's USB stay-awake setting enabled, the same ten-player countdown
   immediately progressed into normal live rounds
3. the `Controllers 0` pill that overlaps the tenth score card at the minimum
   `800x480` size belongs to the development-only preview-controller workspace;
   it is absent from production
4. Google's DHU rejected a custom `1920x720` profile and fell back to `800x480`;
   exact wide-size proof therefore remains browser-based plus Domen's real-car
   capture, while `1280x720` is the stricter same-height native DHU proof
5. the semantic game-session helper originally assumed the default store domain;
   Goal 1 now resolves the active `arcade.surface`, maps logical store names to
   the embedded runtime domain, and fails closed when no active surface exists

Local proof status: complete for the road-trip release gate.

Additional proof completed:

1. the ten-controller match advanced through all ten rounds and reached game
   over after the phone stay-awake correction
2. the six-controller and two-controller lobby layouts fit at `800x480`
3. `1600x720`, `1800x720`, and `1920x720` have no document overflow
4. the exact `1920x720` host rendered QR, Arcade, lobby, active video, prompt,
   timer, and player strip without clipping
5. the integrated Platform suite now passes 162/162 tests, typecheck, lint, and a full
   production build after the host-grant and room-capacity fixes
6. Last Band Standing passes 38/38 tests, typecheck, and a production build
7. focused ESLint, Prettier, and `git diff --check` pass
8. the Android wrapper passes debug unit tests, Android lint, and debug/release
   APK assembly
9. game over and controller-owned restart pass at `1280x720`
10. the two-controller match advanced through all ten rounds and reached game
    over at `800x480`

Remaining car-only proof:

1. none for the current media and wrapper path
2. repeat a short smoke check only if that path changes

### 2026-07-24 — Real-Car Proof Closed And Browser-First Polish Opened

Confirmed:

1. Domen tested the setup in his real car
2. YouTube video renders
3. audible audio plays
4. Air Jam is operational in the intended car environment

Newly prioritized:

1. make the public on-screen-controller launcher contextual and unobtrusive
2. replace the placeholder Android launcher icon
3. move the phone controller menu handle away from centered camera cutouts
4. make controller final standings scroll correctly with large groups
5. replace selected-category-union distractors with same-quiz-category
   distractors
6. make selected lobby categories unmistakable
7. show readable per-player correctness, timing, and points during host reveal
8. rebalance the catalog toward medium and hard songs
9. run all normal UI and game-flow validation through the browser-first matrix

GitHub tracking:

1. duplicate search found no existing issues in `vucinatim/air-jam`
2. the GitHub connector cannot see `domenkoscak/airjam-mobile`, while the local
   authenticated GitHub CLI can access it
3. seven Air Jam issues and two mobile-wrapper issues are now open and linked in
   Workstream G

### 2026-07-24 — Goal 1 Platform-Ready Foundation Closed

Completed:

1. the public controller launcher now has three explicit contexts:
   1. full `Try controls` discovery in an empty Arcade without an external
      controller
   2. a compact icon-only fallback in non-gameplay contexts or when no external
      controller is available
   3. no idle launcher during an active game with a connected phone or semantic
      controller
2. semantic game sessions now discover the active Arcade game from
   `arcade.surface`, map logical `default` contracts to the concrete
   epoch-scoped embedded store, expose the mapping to callers, and fail closed
   when the active surface cannot be established
3. local Arcade bootstrap was re-proven through app-ID bootstrap, and live logs
   showed rooms created with `maxPlayers: 16`
4. the connected Samsung `SM-S921B` reported:
   1. a 91 physical-pixel display cutout
   2. device pixel ratio `2.625`
   3. computed fullscreen `safe-area-inset-top: 35px`
   4. the top-center controller menu beginning at that safe boundary
5. the Android package now uses the canonical Air Jam mark for adaptive, round,
   and pre-Android-8 launcher resources; the installed app drawer visibly shows
   the correct icon
6. responsive browser proof at `800x480` showed zero document overflow, a clear
   first-visit launcher, a compact game launcher without a phone, and no
   launcher during phone-connected gameplay

Quality gates:

1. SDK: typecheck, build, and 270/270 tests
2. devtools: typecheck, build, and 50/50 tests
3. Platform: typecheck, lint, production build, and 162/162 tests
4. Android wrapper: debug unit tests, Android lint, debug APK, and release APK
5. focused physical-phone and installed-icon proof

Tracking:

1. issues #34 through #38 and mobile issue #1 contain the local implementation
   and validation evidence
2. issue #40 records the newly discovered mismatch between the documented
   `pnpm run dev` command and the root package scripts
3. implementation remains local and unpublished until the user gives the
   explicit release/PR green light

Next primary goal: Goal 2, Last Band Standing correctness and results.

### 2026-07-24 — Goal 2 Last Band Standing Correctness And Results Closed

Completed:

1. separated browsing eligibility from answer fairness:
   1. `bucketIds` determine which songs may enter a playlist
   2. one required `quizCategoryId` determines the only valid distractor pool
2. added one explicit curated integer `difficulty` from 1 through 5 to all 144
   songs
3. made catalog loading reject:
   1. missing or duplicate quiz metadata
   2. quiz categories outside a song's declared buckets
   3. invalid difficulty values
   4. forced distractors from another quiz category
   5. quiz categories without four distinct title and artist labels
4. made round generation select four ID-unique and visible-label-unique options
   from the correct song's full canonical quiz category
5. expanded the semantic game snapshot with:
   1. round quiz category and difficulty
   2. option quiz categories
   3. ranked all-player reveal results
   4. correctness, response time, round points, and cumulative points
6. replaced the reveal player-card strip with one compact all-player results
   table showing rank, player, result, response time, round gain, and total
7. made controller final standings a bounded touch-scroll region with the lobby
   action pinned outside it
8. strengthened selected category presentation on both host and controller with
   checkmarks, contrast, counts, and `aria-pressed`
9. updated the canonical song validator and report with quiz-category viability
   and difficulty distributions

Validation evidence:

1. 42/42 game tests pass
2. exhaustive randomized tests generated 7,200 option sets across every song,
   both guess kinds, and 25 shuffles each without:
   1. duplicate IDs
   2. duplicate visible labels
   3. missing correct answers
   4. quiz-category leakage
3. deterministic catalog validation reports 144 songs, ten browsing buckets,
   ten viable quiz categories, and zero issues
4. YouTube oEmbed validation accepts 144/144 unique videos
5. complete ten-round semantic matches pass with:
   1. two players using the natural countdown/reveal timers
   2. six players using a monotonic synthetic clock and correct, wrong, and
      unanswered outcomes on every reveal
   3. ten players using the same full result-state matrix
6. exact `800x480` and `1920x720` reveal probes show all ten rows, the complete
   scoreboard, and zero layout overflow
7. exact controller probes pass at `360x800`, `390x844`, `412x915`, and
   `430x932`; each reaches the last player while the lobby action stays visible
8. TypeScript, focused ESLint, scoped Prettier, production build, and
   `git diff --check` pass

Framework follow-up:

1. [Air Jam issue #42](https://github.com/vucinatim/air-jam/issues/42) records
   that game-session tooling loads the wrong agent contract when a game-local
   `cwd` is supplied without an explicit `gameId`
2. explicit `gameId: "last-band-standing"` is the validated non-blocking
   workaround

Intentional Goal 3 carry-forward:

1. the new difficulty field truthfully exposes that Rock / Classics,
   Throwbacks, 2000s, and especially 2010s are still easy-heavy
2. changing that distribution requires the user-facing song curation and
   medium/hard additions already assigned to Goal 3

Next primary goal: Goal 3, content and visual polish.

### 2026-07-24 — Goal 3 Content And Visual Polish In Progress

Completed in the first checkpoint:

1. audited the current 144-song difficulty distribution:
   1. 69 difficulty 1
   2. 41 difficulty 2
   3. 20 difficulty 3
   4. 12 difficulty 4
   5. 2 difficulty 5
2. implemented an intentional balanced playlist selector:
   1. a ten-round match requests three difficulty 1-2 songs
   2. five difficulty 3 songs
   3. two difficulty 4-5 songs
   4. unplayed songs remain more important than repeating a perfect band mix
   5. unavailable bands fall back without blocking narrow category selections
3. prepared the 36-song review slate above, targeting a final catalog of 180
   songs; YouTube and clip work remains intentionally pending user approval
4. replaced the controller lobby's oversized horizontal category carousel with
   one compact two-column grid that exposes all ten categories at once
5. expanded controller round reveals with:
   1. explicit correct, incorrect, or no-answer status
   2. response time
   3. the player's submitted answer
   4. the complete correct artist and title
   5. the quickest correct player and time
6. made long active-round and reveal labels wrap instead of clipping
7. enlarged the host reveal table for wide displays while keeping a dedicated
   compact grid at `800x480`
8. verified at `360x800` that the full identity header, name field, all category
   controls, and pinned ready action remain visible
9. verified a long `Parni Valjak — Sve još miriše na nju` reveal at `800x480`;
   every scoreboard column remains visible and the layout has no horizontal
   overflow
10. completed the exact phone viewport matrix at `360x800`, `390x844`,
    `412x915`, and `430x932`:
    1. unready and ready lobbies expose all ten categories and their pinned
       actions without document overflow
    2. active rounds keep all four answers visible in a two-by-two grid
    3. reveal content, long answers, quickest-player details, and the countdown
       remain readable without clipping or horizontal overflow
11. verified the lobby on the connected Samsung `SM-S921B` at its physical
    `1080x2340` capture size:
    1. the Air Jam identity header remains fully visible
    2. the name input and all ten categories fit above the ready action
    3. the game remains usable even with Chrome's address and navigation bars
       reducing the available viewport
12. added deterministic complete-match coverage at 2, 6, and 10 players:
    1. all players ready and enter the same ten-round match
    2. every round accepts all answers and produces a complete reveal
    3. scoring accumulates through all ten rounds
    4. game over ranks and retains every participant
13. prepared non-committal metadata for all 36 review candidates:
    1. every proposed video currently passes the repository-equivalent YouTube
       oEmbed check
    2. no proposed video id or canonical song duplicates the current catalog
    3. every song has a provisional clip start ready for post-approval sampling
    4. the Niet upload is explicitly flagged as the only non-official source

Quality evidence:

1. 51/51 game tests pass
2. game typecheck passes
3. focused ESLint passes
4. scoped Prettier and `git diff --check` pass

Framework follow-up:

1. [Air Jam issue #43](https://github.com/vucinatim/air-jam/issues/43) records
   that `RuntimeShellHeader` can flex-shrink to zero when controller content has
   a tall intrinsic layout
2. Last Band Standing uses a narrow `shrink-0` workaround until the shared
   component owns that invariant
3. [Air Jam issue #44](https://github.com/vucinatim/air-jam/issues/44) records
   the unrelated Railway platform-preview failure: `run-platform.mjs`
   dynamically imports migration packages that are absent from the Next
   standalone runtime image
4. production remains healthy; the preview-infrastructure repair is deliberately
   separated from Goal 3 game content and UI work

Still required to close Goal 3:

1. user approval or edits to the proposed song slate
2. approved-song metadata, YouTube, and clip validation
3. final visual review across every supported host and phone size
4. rerun the deterministic two-, six-, and ten-player regression matches with
   the final catalog
