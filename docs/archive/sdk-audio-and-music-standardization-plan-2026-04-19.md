# SDK Audio And Music Standardization Plan

Last updated: 2026-04-19  
Status: implemented and archived

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [V1 Release Launch Plan](./v1-release-launch-plan.md)
4. [Final Prerelease Hardening And Cleanup Plan](./final-prerelease-hardening-and-cleanup-plan.md)
5. [Final Release Checks Plan](./final-release-checks-plan.md)

## Purpose

Make Air Jam audio ownership canonical across first-party games.

The immediate problem is not pause behavior. The problem is that several games still own media directly, which makes Arcade/platform audio settings inconsistent and encourages each game to invent its own audio runtime.

This plan defines one SDK-owned path for:

1. sound effects
2. controller remote sounds
3. background music playlists
4. external media volume adapters such as YouTube iframes

## Current Baseline

Already good:

1. `pong` uses `AudioRuntime` on host and `ControllerRemoteAudioRuntime` on controller.
2. `the-office` uses `AudioRuntime` and `useAudio` for host sound effects.
3. `last-band-standing` uses SDK audio for host/controller sound effects.
4. `air-capture` uses SDK audio for host/controller sound effects through a game-owned facade.

Known gaps:

1. `code-review` uses direct `new Audio(...)` for crowd ambience and one-shot effects.
2. `air-capture` owns music through a custom `HTMLAudioElement` playlist driver.
3. `last-band-standing` uses YouTube iframe audio for quiz clips, with manual volume/mute commands that do not currently scale through the SDK music volume contract.

## Decision

The canonical music API should be **declarative** and mounted under `AudioRuntime`.

The primary public primitive should be a component:

```tsx
<AudioRuntime manifest={soundManifest}>
  <MusicPlaylist
    id="match"
    tracks={["bgm_track_1", "bgm_track_2", "bgm_track_3"]}
    playing={matchPhase === "playing" && !audioMuted}
    order="shuffle"
    fadeMs={1200}
  />
  <HostScreen />
</AudioRuntime>
```

This should be the one true path for game-owned background music.

Why this shape:

1. it matches React game surfaces better than an imperative singleton
2. it is hard to misuse because playback follows visible state
3. it keeps music below the existing `AudioRuntime` unlock/settings/socket owner
4. it avoids each game creating `new Audio(...)`
5. it lets Arcade/platform `masterVolume` and `musicVolume` apply automatically
6. it gives future agent/tooling surfaces a declarative contract to inspect

Imperative hooks can exist internally or as advanced helpers later, but first-party games should use the declarative component by default.

## Non-Goals

Do not build a full adaptive-audio engine in this pass.

Out of scope:

1. beat/bar synchronized transitions
2. layered stems
3. sidechain ducking
4. WebAudio graph authoring
5. spatial music beds
6. a visual music timeline editor
7. global pause-audio behavior

These may matter later, but they should not be smuggled into the first music standardization pass.

## SDK Contract

### Sound Manifest

Keep using the existing `SoundManifest`.

Music tracks should be declared as normal manifest entries:

```ts
export const soundManifest = {
  bgm_track_1: {
    src: ["/music/track_1.mp3"],
    volume: 0.4,
    category: "music",
    html5: true,
  },
  hit: {
    src: ["/sounds/hit.wav"],
    volume: 0.5,
    category: "sfx",
  },
} satisfies SoundManifest;
```

Rules:

1. `category: "music"` means platform `musicVolume` applies.
2. `category: "sfx"` means platform `sfxVolume` applies.
3. `masterVolume` always applies.
4. tracks used by `MusicPlaylist` must be manifest-owned.
5. games should not create raw `Audio`, `HTMLAudioElement`, `Howl`, or `AudioContext` instances for ordinary game audio.

### MusicPlaylist

Add an SDK component, likely exported from `@air-jam/sdk`:

```ts
interface MusicPlaylistProps<TTrackId extends string = string> {
  tracks: readonly TTrackId[];
  playing: boolean;
  order?: "sequence" | "shuffle";
  fadeMs?: number;
  startIndex?: number;
}
```

Initial defaults:

1. `order = "sequence"`
2. `fadeMs = 1000`
3. `startIndex = 0`

Behavior:

1. when `playing` becomes true, start the selected track with fade-in
2. when `playing` becomes false, fade out and stop
3. when a track ends, move to the next track
4. do not cut the current track just because a timer elapsed
5. never bypass platform audio settings
6. cleanly stop on unmount

Deferred on purpose:

1. no public `transition` prop until there is a real first-party need for mid-track transitions
2. no public playlist `id` until there is a real runtime-inspection or multi-playlist control surface
3. no separate restart policy until a game needs to preserve track identity across dynamic playlist changes

### External Media Volume Adapter

Some media cannot live inside `AudioRuntime`, especially YouTube iframes.

Add a small SDK hook for external media adapters:

```ts
const musicVolume = useAudioCategoryVolume("music");
const masterVolume = useAudioCategoryVolume("master");
```

Or a narrower helper:

```ts
const musicVolume = useMusicVolume();
```

The hook should return the effective normalized volume after inherited platform settings.

Last Band Standing can then scale YouTube volume as:

```ts
setYouTubeVolume(frame, intendedYoutubeVolume * musicVolume);
```

This keeps YouTube integration game-specific while making the volume contract SDK-owned.

## Implementation Shape

### SDK Work

1. Extend `AudioManager` with the smallest controls needed by `MusicPlaylist`:
   1. play a manifest sound and receive a playback id
   2. fade a playback id
   3. stop a playback id
   4. observe or register track end for a playback id
2. Keep settings application inside `AudioManager`; do not duplicate volume math in games.
3. Add `MusicPlaylist` under the existing audio runtime context.
4. Add `useAudioCategoryVolume` or `useMusicVolume` for external media.
5. Add SDK tests for:
   1. music uses `musicVolume`
   2. sfx uses `sfxVolume`
   3. playlist advances only on track end by default
   4. `playing=false` fades/stops
   5. unmount cleans up active tracks

### Air Capture Migration

Replace the custom music driver with SDK music.

Remove or collapse:

1. `createHostMusicDriver`
2. `createRotatingMusicPlayback`
3. direct `new Audio(src)` music ownership
4. custom music platform-volume syncing

Keep:

1. the existing host SFX facade if it remains useful for engine boundaries
2. the existing controller remote audio runtime
3. sound manifests, with music tracks moved into the SDK manifest path

Desired result:

```tsx
<AudioRuntime manifest={HOST_AUDIO_MANIFEST}>
  <MusicPlaylist
    tracks={HOST_MUSIC_TRACKS}
    playing={audioRuntimeReady && !audioMuted && shouldPlayMusic}
    order="shuffle"
    fadeMs={1200}
  />
  {children}
</AudioRuntime>
```

The jarring current behavior where tracks cut mid-song should disappear because the default transition is track-end.

### Code Review Migration

Move all Code Review audio into SDK audio.

Create a game sound manifest:

1. `crowd` as `category: "music"` or `category: "sfx"` depending on intended settings behavior
2. `bell`
3. `hit1`
4. `hit2`
5. `missed`

Recommended classification:

1. `crowd`: `category: "music"` if treated as ambient bed controlled by music volume
2. one-shots: `category: "sfx"`

Replace:

1. `new Audio("/sounds/crowd.mp3")`
2. direct one-shot `new Audio(...)`
3. local volume rewrites

With:

1. `AudioRuntime`
2. `useAudio`
3. `MusicPlaylist` or a looped `audio.play("crowd", { loop: true })` if crowd is not meant to rotate

Prefer `MusicPlaylist` for ambience if we want one declarative music/ambient owner.

### Last Band Standing YouTube Adapter

Keep YouTube playback game-owned, because iframe playback cannot be represented as a normal `AudioRuntime` track.

Add SDK settings awareness:

1. read effective music volume through SDK helper
2. scale every intended YouTube volume by that value
3. keep host mute behavior as an additional hard mute

This means:

1. Arcade master volume affects YouTube clips
2. Arcade music volume affects YouTube clips
3. Arcade sfx volume still only affects SDK sound effects

Do not try to force YouTube into `MusicPlaylist`.

## Migration Order

1. Add SDK music primitives and tests.
2. Migrate Air Capture music to `MusicPlaylist`.
3. Migrate Code Review to `AudioRuntime` and SDK-owned music/SFX.
4. Add Last Band Standing YouTube volume adapter.
5. Update scaffold sources for every changed first-party game.
6. Add or update docs showing the canonical audio pattern.

## Acceptance Criteria

Done means:

1. no first-party game uses direct `new Audio(...)` for normal game audio except a documented external-media adapter
2. `air-capture` background music no longer cuts tracks on a fixed timer
3. `code-review` audio responds to Arcade/platform settings
4. `last-band-standing` YouTube clip volume responds to Arcade/platform master/music volume
5. first-party scaffold sources match the repo games
6. SDK tests cover the playlist and external volume-helper contracts
7. game tests/typechecks/builds pass for affected games

## Guardrails

1. Do not add per-game runtime-pause plumbing as part of this plan.
2. Do not add one-off music drivers inside games.
3. Do not expose multiple equivalent public APIs for music in the first pass.
4. Do not require every game to mount music if it has no music.
5. Keep the SDK surface small enough that generated games can follow one obvious pattern.
