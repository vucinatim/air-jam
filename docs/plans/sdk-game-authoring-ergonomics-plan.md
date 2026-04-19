# SDK Game Authoring Ergonomics Plan

Last updated: 2026-04-19  
Status: active implementation

Related docs:

1. [Framework Paradigm](../framework-paradigm.md)
2. [Work Ledger](../work-ledger.md)
3. [SDK Audio And Music Standardization Plan](../archive/sdk-audio-and-music-standardization-plan-2026-04-19.md)
4. [Standard Lifecycle Contract Plan](../archive/standard-lifecycle-contract-plan-2026-04-09.md)

## Purpose

Tighten the first-party SDK authoring path so normal games feel minimal, direct, and easy to reason about.

The goal is not to add more framework UI or configurability. The goal is to remove confusing public concepts, keep ownership boundaries obvious, and make first-party games read like examples a developer would want to copy.

## Current Diagnosis

The primitives are mostly correct, but several first-party usages expose too much framework machinery:

1. games manually read audio runtime status and controls for normal music playback
2. `SurfaceViewport preset` is vague and harder to understand than explicit design dimensions
3. host files contain small engine/math helpers that should live beside game engine code
4. `useHostRuntimeStateBridge` couples standard match phases to framework pause/play state even though those concepts are independent
5. the old host lobby shell naming made a small join-control hook sound like a full host shell
6. some game-local type expressions expose SDK/internal TypeScript mechanics instead of readable domain names
7. preview-controller dock accessories are being used for host controls that do not semantically belong to controller previewing

## Agreed Direction

## 1. Audio Runtime

Keep:

1. `AudioRuntime`
2. `ControllerRemoteAudioRuntime`
3. `useAudio`
4. `MusicPlaylist`

First-party games should not use `useAudioRuntimeStatus` or `useAudioRuntimeControls` for ordinary background music.

Preferred game code:

```tsx
<AudioRuntime manifest={SOUND_MANIFEST}>
  <MusicPlaylist playing={!audioMuted} tracks={MUSIC_TRACKS} />
  {children}
</AudioRuntime>
```

`MusicPlaylist` should internally respect audio readiness. If the browser blocks audio, playlist startup should wait until the runtime is ready instead of forcing game code to check runtime status.

`useAudioRuntimeStatus` may remain as an advanced escape hatch if a game wants a custom "enable audio" UI. `useAudioRuntimeControls` should not appear in first-party game code unless there is a specific reason.

## 2. Mute Ownership

Game-owned mute state is acceptable.

This is simple enough and does not require a new SDK abstraction:

```tsx
const [audioMuted, setAudioMuted] = useState(false);
const audio = useAudio();

useEffect(() => {
  audio.mute(audioMuted);
}, [audio, audioMuted]);
```

Do not add a broad SDK `HostStandaloneControls` surface for this. Games can render their own mute button and wire it to `audio.mute`.

The current `HostPreviewControllerWorkspace dockAccessory` usage for mute controls is visually convenient but semantically muddy. The preview-controller workspace should not become a generic host toolbar.

## 3. SurfaceViewport API

`orientation` and `preset` are currently separate concepts:

1. `orientation` controls forced orientation and controller presentation sync
2. `preset` chooses a reference design size for responsive scaling

The concept is valid, but `preset` is not a good author-facing prop.

Target authoring model:

```tsx
// Host default.
<SurfaceViewport>
  {children}
</SurfaceViewport>

// Controller default, with forced orientation when needed.
<SurfaceViewport orientation="landscape">
  {children}
</SurfaceViewport>

// Advanced custom design size.
<SurfaceViewport designWidth={1280} designHeight={720}>
  {children}
</SurfaceViewport>
```

`SurfaceViewport` can infer default reference dimensions from SDK session scope:

1. host defaults to the host reference size
2. controller defaults to the phone reference size

Advanced users can still pass `designWidth` and `designHeight` directly.

## 4. Pong Runtime Buffers

Pong's current `runtimeStateRef`, `previousRuntimeStateRef`, and `renderStateRef` are valid fixed-step simulation buffers:

1. current simulation state
2. previous simulation snapshot
3. interpolated render-only state

The problem is not the model. The problem is that buffer copying and interpolation helpers live in the host orchestration file.

Move the helper code into the Pong engine layer so the host reads as orchestration:

```ts
const runtimeBuffers = createRuntimeStateBuffers();

copyRuntimeState(runtimeBuffers.previous, runtimeBuffers.current);
stepGame({ state: runtimeBuffers.current, ... });
interpolateRuntimeState(runtimeBuffers.render, runtimeBuffers.previous, runtimeBuffers.current, alpha);
```

## 5. Host Join Controls Naming

The old host lobby shell hook should be renamed because it does not own a full shell.

Preferred name:

```ts
useHostJoinControls;
```

It can continue to own:

1. join URL value
2. copied state
3. copy/open handlers
4. QR visibility
5. optional guarded start handler

## 6. Game Sound Types

Game code should not expose noisy generic expressions such as:

```ts
keyof typeof PONG_SOUND_MANIFEST & string
```

Prefer named domain types:

```ts
export type PongSoundId = keyof typeof PONG_SOUND_MANIFEST;

const audio = useAudio<PongSoundId>();
```

SDK internals can keep `keyof M & string` where needed, but first-party games should read like game code.

## Runtime State Decision

This decision is now settled.

Current terms:

1. `matchPhase` is game/app lifecycle state
2. `runtimeState` is framework room pause/play state

Current implementation truth:

1. first-party game phases live in each game's `createAirJamStore` state
2. the SDK exports standard phase types/helpers, but it does not own a separate server-side `matchPhase` lane
3. server `runtimeState` is room-level pause/play state broadcast through room state
4. `runtimeState` does not pause the socket connection or stop controller input forwarding by itself
5. games/controllers choose to respect `runtimeState` in UI and simulation guards

`runtimeState` should stay, but it should be treated as a simple framework-owned pause/play flag. It should not be coupled to match lifecycle.

Correct model:

1. when a game opens, runtime should be `"playing"`
2. lobby still runs with runtime `"playing"`
3. countdown/gameplay/ended still run with runtime `"playing"`
4. runtime only becomes `"paused"` when the user or shell explicitly pauses it
5. runtime becomes `"playing"` again only through an explicit resume/play command
6. any match phase can coexist with either runtime state

Valid combinations include:

```ts
matchPhase = "lobby";
runtimeState = "playing";

matchPhase = "playing";
runtimeState = "paused";

matchPhase = "ended";
runtimeState = "playing";
```

The game owns phase. The framework owns generic room pause/play.

The game loop can still combine both facts when deciding whether gameplay simulation should advance:

```ts
const shouldSimulate =
  matchPhase === "playing" && host.runtimeState === "playing";
```

This does not mean `matchPhase` should mutate `runtimeState`.

## Bridge Purge Decision

`useHostRuntimeStateBridge` should be removed entirely.

The hook encodes the wrong policy:

1. active match phases should automatically force runtime playing
2. inactive match phases should automatically force runtime paused

That policy is not part of the framework model. It creates a fake dependency between lifecycle and pause/play.

What the hook currently does:

1. stores the previous match phase in a ref
2. calls optional transition callbacks
3. used to toggle runtime state when phase moved into or out of an SDK-defined active phase

What it does not do:

1. it does not affect socket connection lifetime
2. it does not stop controller input forwarding
3. it does not power visual harness internals
4. it does not provide a machine-readable agent contract
5. it does not own game lifecycle truth

Therefore it is not a framework primitive. It is a cleanup-era convenience hook that promoted an incorrect policy into the public SDK.

Purge scope:

1. remove the hook source and tests
2. remove the root SDK export
3. remove first-party game imports and call sites
4. remove generated/scaffold docs that teach it
5. remove game README mentions
6. remove phase/runtime bridge language from host comments
7. keep any game-local transition side effects as explicit game code

## Runtime State API Cleanup

Keep `runtimeState`, but replace toggle-only authoring with explicit commands.

Changes:

1. add explicit commands:
   1. `host.pauseRuntime()`
   2. `host.resumeRuntime()`
   3. `host.setRuntimeState("paused" | "playing")`
2. remove the old toggle-only public host path
3. make new game sessions start with runtime `"playing"` where appropriate
4. document that `runtimeState` does not pause sockets or input transport
5. teach `runtimeState` as shell/runtime pause state, not game lifecycle
6. keep `matchPhase` fully game-owned in the networked game store

## Proposed Implementation Order

1. Runtime-state API cleanup
2. Complete `useHostRuntimeStateBridge` purge
3. SurfaceViewport prop cleanup
4. Rename the old host lobby shell hook to `useHostJoinControls`
5. Audio usage cleanup
6. Pong helper/type cleanup

## Success Criteria

1. minimal game remains minimal
2. first-party hosts no longer read audio runtime status for normal music
3. first-party controllers/hosts no longer pass `preset` to `SurfaceViewport`
4. first-party games no longer use `useHostRuntimeStateBridge`
5. runtime state docs clearly say it does not pause sockets/input transport
6. game phase remains visibly owned by each game's networked store
7. new game/open-room runtime state is playing unless the user explicitly pauses
8. no docs teach phase/runtime synchronization as a default path
