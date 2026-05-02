# Composition Shell Contract

This template supports two valid ways to build host/controller shell UI:

1. compose from shared SDK shell atoms
2. build fully custom shell markup

Both are acceptable.
What is not acceptable is breaking the required lifecycle and room-join behavior contract.

## Required Host Lobby Contract

The host lobby should expose:

1. room/join context
2. QR access, either inline or via an obvious overlay trigger
3. controller join URL field
4. copy join URL action
5. open join URL action
6. primary start/play action

The theme, layout, typography, and art direction stay game-owned.

## Required Controller Contract

The controller shell should expose:

1. top status bar with connection state
2. player identity/avatar area
3. lifecycle action cluster in a consistent top position
4. gameplay controls below the shell

Lifecycle actions should stay in this order when present:

1. `Start`
2. `Pause` or `Resume`
3. `Back to Lobby`

## Composition-First Default Path

If the game does not need a highly custom shell, prefer composing from:

1. `RuntimeShellHeader`
2. `ConnectionStatusPill`
3. `LifecycleActionGroup`
4. `JoinUrlField`
5. `JoinUrlActionButtons`
6. `JoinUrlControls`
7. `JoinQrOverlay`
8. `RoomQrCode` when a game truly needs inline QR presentation
9. `HostMuteButton` where host audio mute is needed

When lifecycle action visibility or labels should stay shared, prefer `useLifecycleActionGroupModel` and render from its returned action descriptors.

For shared shell state and handler wiring, prefer:

1. `useHostJoinControls`
2. `useControllerShellStatus`
3. `useControllerLifecyclePermissions`
4. `useControllerLifecycleIntents`
5. `useLifecycleActionGroupModel`

## Full-Custom Path

If the game wants a completely custom shell:

1. keep the host/controller behavior contract intact
2. keep lifecycle actions as controller intents, not direct authority bypasses
3. keep host/store actions authoritative for actual lifecycle transitions
4. do not remove the required room/join and controller lifecycle affordances

Full-custom is about presentation freedom, not behavior freedom.

## Avoid

1. duplicate lifecycle controls in both a shared shell and a legacy local panel
2. controller-only state mutation that bypasses host/store authority
3. hiding join URL actions or start controls on the host lobby
4. making shell controls drift to different positions across games without a strong reason

## Authoring Rule

When changing shell UI:

1. prefer shared atoms for common behavior
2. prefer local wrappers for theme-specific styling
3. add direct tests when a shared shell component or shared shell behavior changes
