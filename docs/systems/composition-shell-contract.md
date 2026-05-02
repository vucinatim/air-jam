# Composition Shell Contract

Last updated: 2026-04-08  
Status: active

This contract defines the baseline host and controller shell behavior for repo-owned Air Jam games.

The goal is consistency of function and slot structure, not visual sameness.

## Required Host Lobby Contract

Every launch-set game host lobby should expose:

1. room/join context
2. QR code
3. controller join URL field
4. copy join URL action
5. open join URL action
6. primary start/play action

Games keep full control over theme, typography, layout treatment, and art direction.

## Required Controller Contract

Every launch-set game controller shell should expose:

1. top status bar with connection state
2. player identity/avatar region
3. lifecycle action cluster in a consistent top position
4. gameplay controls below the shell

Lifecycle actions should keep this order when present:

1. `Start`
2. `Pause` or `Resume`
3. `Back to Lobby`

## Composition-First Default

For the default path, prefer composing from small SDK UI pieces:

1. `RuntimeShellHeader`
2. `ConnectionStatusPill`
3. `LifecycleActionGroup`
4. `JoinUrlField`
5. `JoinUrlActionButtons`
6. `JoinUrlControls`
7. `RoomQrCode`
8. `HostMuteButton` where host audio mute is needed

For shared behavior, prefer the headless hooks:

1. `useHostJoinControls`
2. `useControllerShellStatus`
3. `useControllerLifecyclePermissions`
4. `useControllerLifecycleIntents`
5. `useLifecycleActionGroupModel` when rendering the lifecycle actions manually

## Full-Custom Path

Fully custom shells are valid.

That freedom is about presentation, not behavior contract.

Custom shells should still:

1. keep lifecycle actions as controller intents
2. keep host/store actions authoritative for actual lifecycle transitions
3. keep required host join affordances intact
4. keep status and lifecycle actions in stable controller shell positions

## Avoid

Do not:

1. ship both a shared-shell path and a legacy local lifecycle shell in the same game
2. mutate lifecycle state directly from controllers in ways that bypass host/store authority
3. hide host join URL actions or the primary start action
4. drift lifecycle ordering or shell positions without a strong product reason

## Authoring Rule

When changing shell UI:

1. prefer shared hooks for common policy and handler wiring
2. prefer local wrappers for theme-specific styling
3. add direct tests when shared shell behavior changes
4. keep docs, scaffolds, and repo-owned reference games aligned in the same pass
