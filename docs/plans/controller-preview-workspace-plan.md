# Controller Preview Workspace Plan

Last updated: 2026-04-11  
Status: active

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Stage 3 Polish Plan](./stage-3-polish-plan.md)
3. [Final Prerelease Manual Check Plan](./final-prerelease-manual-check-plan.md)
4. [Controller Preview Dock Plan (Archived)](../archive/controller-preview-dock-plan-2026-04-09.md)
5. [Framework Paradigm](../framework-paradigm.md)

## Purpose

Replace the current docked preview-controller UI with a lightweight preview workspace that feels closer to a small desktop window model.

This plan exists because the current preview-controller feature is no longer blocked at the architecture level, but it still falls short at the product level:

1. the current launcher affordance is not reliable enough under live host layering
2. the docked card presentation is too intrusive and too static
3. the preview chrome still feels like dev tooling instead of an intentional product surface

The goal is to keep the same runtime truth while upgrading the interaction model:

1. real controller route
2. real room/session behavior
3. much lighter and less intrusive host-side UI

## Current Baseline

Already true:

1. preview controllers are a shared SDK-owned feature instead of per-game glue
2. repo games and scaffold games already mount the same host-side preview entrypoint
3. preview controllers still use the real controller route and room/session model
4. close/reopen lifecycle already prefers fresh controller sessions instead of fake seat restore

Current problems:

1. the visible launcher affordance is not reliably clickable on live host surfaces
2. the dock sits inside the host layout as a fixed bottom-right product block instead of a lightweight overlay workspace
3. expanded previews read as stacked cards, not small movable controller windows
4. current preview chrome shows more surface than necessary and competes with the host UI
5. inactive previews do not yet have the low-noise "there when needed, nearly gone when not needed" behavior

Live Pong standalone inspection confirmed the current issue is not only taste:

1. the visible `Add controller` affordance can fail hit testing against the host shell
2. the current dock model is the wrong product metaphor even when it does work

## Product Goals

The new preview-controller workspace should feel:

1. obvious on first use
2. minimal when idle
3. intuitive for desktop users
4. non-blocking for host play/testing
5. consistent across all games without per-game customization

The product rule is:

1. phone controllers remain canonical
2. on-screen preview controllers become a polished fast-try and dev-testing path
3. preview controllers should feel like lightweight live tools, not heavy docked panels

## Scope

This plan covers:

1. the SDK preview-controller presentation layer
2. host-side preview session management state needed for floating windows
3. the launcher, floating window chrome, minimize/close behavior, opacity behavior, and drag behavior
4. repo game and scaffold migration to the new shared workspace component
5. validation in standalone Pong first, then the rest of the launch set

This plan does not cover:

1. a second controller runtime path
2. fake local controller simulators
3. persistent preview-window layout across page reloads
4. advanced persistent desktop/window-manager features beyond drag, resize, minimize, and close
5. a full desktop/window-manager feature set
6. game-specific preview UI customization

## Core Decisions

### 1. Keep the Real Controller Runtime

Nothing about this rework should change the runtime truth:

1. every preview controller is still a real controller client
2. every preview controller still joins the same room as phone controllers
3. host/game logic should not care whether a controller came from phone or preview

This plan changes presentation and local management, not topology.

### 2. Replace the Dock Metaphor

The old dock metaphor should be removed from the active product surface.

The new metaphor is:

1. one tiny launcher
2. one floating workspace layer
3. one small draggable window per controller session

The current `dock` naming should not stay as the primary concept after the rework lands.
The end state should use `workspace` terminology in the SDK and consumers.

### 3. Render Preview UI Outside Game Layout

The launcher and controller windows should be rendered through a portal mounted at the document body level.

This is required so that:

1. preview chrome does not depend on each game's stacking contexts
2. the launcher can stay the highest-priority hit target
3. windows can float above the host cleanly without re-fighting game layout CSS

### 4. Keep The Surface Minimal

The preview workspace should expose only the controls that matter:

1. spawn new controller
2. restore minimized controller
3. close controller
4. minimize controller
5. drag controller

Anything non-essential should move to tooltip-level guidance rather than permanent text.

## Target UX

### Launcher

The launcher should be:

1. always visible when preview controllers are enabled
2. always clickable above the host surface
3. small and visually quiet
4. positioned in one stable corner by default

Baseline behavior:

1. click launcher -> spawn a new controller window
2. if minimized controllers exist, the workspace shows a tiny restore shelf or chips next to the launcher
3. the launcher remains usable regardless of host state or overlay state

### Floating Windows

Each preview controller window should:

1. open as a compact portrait-oriented floating window
2. use a very small title bar
3. be draggable only by that title bar
4. include only minimize and close controls
5. use thin or nearly invisible chrome
6. cascade from previous window placement instead of stacking in one dock column

Window lifecycle:

1. spawn -> create a fresh session and open a new window
2. minimize -> hide the window but keep the controller session connected
3. restore -> bring the same session back into a window
4. close -> disconnect and remove the controller session entirely

### Active vs Inactive Behavior

The workspace should be deliberately quiet when the user is not interacting with it.

Required behavior:

1. inactive windows fade to a very low-opacity state
2. active, hovered, focused, or dragged windows become fully opaque
3. inactive windows must not behave like invisible click blockers over the host

The key rule is:

1. low-opacity preview windows should stay discoverable
2. they must not steal normal host interaction when they are effectively idle

## Architecture Plan

## Workstream 1. Replace Dock Ownership With Workspace Ownership

Create the new shared surface around a workspace primitive instead of a dock primitive.

Target structure:

1. `PreviewControllerWorkspace`
2. `HostPreviewControllerWorkspace`
3. `PreviewControllerLauncher`
4. `PreviewControllerWindow`
5. `PreviewControllerMinimizedShelf` or equivalent minimal restore surface

Migration rule:

1. do not keep both dock and workspace as long-lived parallel products
2. migrate internal consumers and remove the old primary dock metaphor in the same refactor

## Workstream 2. Upgrade Session Manager State

The current manager already owns session lifecycle.
It now needs enough local window state to support floating interaction.

Add state for:

1. `x`
2. `y`
3. `zIndex`
4. `minimized`
5. `active`

Keep:

1. real session identity
2. launch URL
3. ready/loading/failed surface state

Rules:

1. new windows cascade from the previous active window
2. focus raises a window to the top
3. minimizing does not destroy the session
4. closing still removes the session entirely

Do not add:

1. layout persistence across reloads
2. seat restoration complexity
3. per-game manager extensions

## Workstream 3. Build Minimal Window Chrome

The new window chrome should resemble a lightweight OS-style utility window without becoming decorative.

Chrome requirements:

1. tiny title bar
2. minimal label
3. tiny state treatment if needed
4. minimize button
5. close button

Avoid:

1. large status blocks
2. repeated explanatory copy
3. thick borders
4. heavy shadows that compete with the game

Tooltips should carry any secondary guidance.

## Workstream 4. Fix Hit Testing And Layering Properly

Do not solve the current launcher bug with ad hoc z-index inflation inside game screens.

The correct fix is:

1. portal-based workspace root
2. explicit top-level stacking contract
3. explicit pointer-events contract for launcher, windows, inactive windows, and iframes

This workstream is complete when:

1. the launcher is always clickable
2. active windows are always interactable
3. inactive windows do not create confusing dead zones over the host

## Workstream 5. Implement Drag And Window Activation

Dragging should feel obvious and frictionless.

Rules:

1. drag starts only from the title bar
2. pointer-down activates and raises the window
3. window position remains where the user leaves it until page reload
4. dragging should not cause iframe interaction conflicts

The simplest stable version is preferred over a feature-rich drag system.

## Workstream 6. Implement Opacity And Idle Behavior

Opacity behavior is a core product requirement, not decoration.

Required model:

1. inactive window chrome becomes low-opacity
2. active or hovered window returns to full opacity
3. the transition should feel smooth but fast

Interaction rule:

1. an inactive window should not keep full iframe hit testing
2. activation should be easy without making the host feel blocked

This means the implementation should intentionally control pointer-events behavior for the inactive state instead of relying only on CSS opacity.

## Workstream 7. Pong-First Validation

Use Pong standalone live dev in Chrome as the primary validation surface while building the rework.

Validate:

1. launcher clickability over all host states
2. opening multiple controllers
3. dragging windows
4. minimizing and restoring windows
5. closing windows and confirming clean disconnect
6. coexistence with the host lobby and active match UI
7. low-opacity idle windows not harming host interaction

Pong is the proving ground because it is the simplest fast-feedback host/controller loop.

## Workstream 8. Launch-Set And Scaffold Rollout

After Pong is stable:

1. migrate the remaining launch-set games if any consumer changes are needed
2. update scaffold consumers
3. rerun scaffold and repo validation

Because preview controllers are already SDK-owned, this should mostly be a shared rollout rather than five separate redesigns.

## Suggested Execution Order

1. replace dock ownership with workspace ownership
2. move the preview layer into a portal with a real hit-testing contract
3. extend manager state for window position/focus/minimize
4. implement minimal launcher and restore shelf
5. implement draggable floating windows
6. implement active/inactive opacity and pointer behavior
7. validate in standalone Pong with Chrome
8. sweep the rest of the launch set and scaffolds
9. update docs and screenshots if the surface materially changes

## Validation

Required checks:

1. `pnpm --filter sdk test`
2. `pnpm --filter sdk typecheck`
3. standalone Pong live verification in Chrome
4. at least one mixed-session proof with preview plus normal controller behavior
5. `pnpm test:scaffold`

Manual acceptance proof should explicitly confirm:

1. one launcher can spawn multiple windows
2. windows can be dragged independently
3. minimized controllers remain connected and restorable
4. close actually removes the session
5. idle windows are unobtrusive
6. the host remains usable underneath

## Done Criteria

This plan is complete when:

1. the old dock metaphor is gone from the active product surface
2. preview controllers open through one tiny always-clickable launcher
3. each controller appears as a lightweight draggable floating window
4. minimize and close behavior are both clear and reliable
5. inactive windows become low-noise without creating invisible host blockers
6. Pong standalone proof feels polished enough to show to users without apology
7. the shared SDK workspace works across the launch-set and scaffold surfaces
