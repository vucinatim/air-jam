# Platform Settings Runtime Plan

Status: completed baseline  
Owner: framework / platform

## Goal

Replace the old audio-only volume-store model with one explicit shared settings runtime owned by the platform shell and inherited by embedded games.

## Scope

1. `PlatformSettingsRuntime`
2. `usePlatformSettings()`
3. `useInheritedPlatformSettings()`
4. `usePlatformAudioSettings()`
5. iframe sync of full settings snapshots
6. migration from `air-jam-volume-settings` to `air-jam-platform-settings`

## Rules

1. parent/platform is authoritative
2. child games consume inherited settings read-only
3. controller surfaces in an active Arcade room act as remote controls for host-owned shared settings; they must not rely on same-origin local storage to affect host runtime behavior
4. platform settings stay intentionally narrow in v1:
   1. audio
   2. accessibility
   3. feedback
5. no feature-specific global store remains as the canonical path
6. embedded settings delivery uses an explicit child-ready handshake instead of timing luck
7. audio startup follows one runtime policy: attempt on mount, expose `idle | blocked | ready`, retry on interaction
8. blocked autoplay is a visible product affordance, not a silent hidden state

## Completion Bar

1. SDK root exports teach only the new settings model
2. Arcade sync sends full `PlatformSettingsSnapshot` payloads
3. platform shell persists settings locally and restores them on boot
4. child games inherit settings without persisting them
5. Pong and `air-capture` run on the new settings contract
6. Arcade and controller product surfaces expose real shared-settings UI
7. platform accessibility and feedback settings are actually consumed by product UI
8. docs and examples teach one canonical settings path
9. initial iframe settings delivery is deterministic from first load via `AIRJAM_SETTINGS_READY`
10. embedded settings bridge lifecycle is centralized in SDK helpers instead of duplicated ad hoc in product code
11. audio runtime exposes explicit blocked/ready status and host UI can surface an enable-audio prompt
