# Controller Preview Dock Plan

Last updated: 2026-04-09  
Status: archived

Archived on: 2026-04-09  
Archive reason: prerelease preview-controller implementation is complete; the active release surface now only needs the archived record and ledger summary

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [V1 Release Launch Plan](../plans/v1-release-launch-plan.md)
4. [Prerelease Systems Closeout Plan (Archived)](./prerelease-systems-closeout-plan-2026-04-09.md)
5. [Final Prerelease Manual Check Plan](../plans/final-prerelease-manual-check-plan.md)
6. [Suggestions](../suggestions.md)

## Purpose

Define one explicit prerelease product and architecture track for on-screen preview controllers.

The goal is to let people try and test Air Jam games without requiring a phone as the first step, while still using the real controller runtime and the real room/session model.

This plan is for:

1. lowering the first-use barrier for public game tryout
2. improving local developer testing for scaffolded and repo-owned games
3. doing that through one clean product/runtime model instead of a fake simulator path

This plan is not for:

1. building a separate desktop simulation framework
2. inventing a second controller transport or second session topology
3. putting platform-only behavior into SDK core
4. replacing phone controllers as the primary product interaction

## Product Position

Air Jam should still feel phone-first.

But prerelease UX should not force every curious user or developer to cross the phone-QR barrier before they can even feel a game.

The right position is:

1. phone controllers remain the canonical experience
2. preview controllers become a first-class optional fast-try path
3. preview controllers must behave like real controllers, not like mocked local test tools

## Why This Matters Before Release

This is worth doing before release because it improves two important surfaces at once.

### 1. Public Funnel

Without preview controllers, the first interaction is:

1. see the game
2. scan QR
3. switch devices
4. join room
5. only then try the controller

That is a real barrier.

Preview controllers can shorten that to:

1. open game
2. click `Add controller`
3. immediately feel the controller UI and interaction loop

### 2. Developer Experience

Generated games from `create-airjam` should not require a second device just to verify:

1. controller UI loads
2. join works
3. inputs reach the host
4. multiplayer state updates correctly

Preview controllers make the local feedback loop much tighter for:

1. game authors
2. reviewers
3. docs/tutorial users
4. AI-assisted dev workflows

## Core Decision

Preview controllers must not be a separate runtime path.

They must be:

1. real controller clients
2. in the same room
3. in the same session model
4. using the same controller route and protocol
5. mixable with real phone controllers in the same live game

They must not be:

1. fake local controller state injections
2. direct host-only dev shortcuts
3. a new topology or alternate room model
4. a one-off platform simulation disconnected from scaffolded games

## Architecture Decision

This should be a shared optional feature, not a platform-only feature and not SDK core.

### Ownership

The feature should live as a reusable host-side preview-controller session and launch layer that can be consumed by:

1. the first-party platform Arcade/play surfaces
2. scaffolded standalone games
3. repo-owned games where enabled

The SDK core should continue to own:

1. room/session primitives
2. host/controller runtimes
3. input/state/signal lanes

The preview-controller feature should own:

1. spawning preview controller clients from a host surface
2. preview-controller launch and identity isolation
3. host-local preview lifecycle and surface management
4. the first presentation shell for those sessions

The dock is the first presentation layer, not the primary architecture.

That means:

1. the reusable contract is "launch and manage preview controller sessions"
2. the dock is the first consumer of that contract
3. future detached windows or Studio surfaces should reuse the same launch/session primitives instead of redefining the feature

## Topology Contract

This plan depends on one strict rule:

1. there is no separate preview-controller topology

Preview controllers use the existing controller runtime path.

That means:

1. the host runtime stays unchanged
2. the room/session topology stays unchanged
3. preview controllers connect through the real controller route
4. preview controllers and phone controllers can coexist in one room

If that rule is broken, the feature becomes much harder to trust and much less useful.

## Session Contract

### Required Behavior

1. every preview controller joins as a normal controller session
2. every preview controller gets its own controller identity while active
3. closing a preview controller leaves the room cleanly
4. host and game logic should not need to know whether a controller came from desktop preview or phone

### First-Version Identity Rule

The first implementation should prefer simple lifecycle rules:

1. spawn preview controller -> create a fresh controller session
2. close preview controller -> remove that controller
3. reopen -> create a new controller unless we later prove stable seat restore is worth the complexity

Do not start with durable preview-seat restoration unless there is a strong reason.

## UX Contract

The feature should feel polished, minimal, and easy to understand.

### Host-Side Controls

The host-facing control should be obvious and low-friction.

Suggested baseline:

1. `Add controller`
2. optional quick count presets later, not required in v1
3. easy close/remove/reset affordances

### Preview Window/Card Behavior

Each preview controller should be:

1. compact by default
2. expandable/openable
3. easy to close
4. visually clean and not toy-like
5. easy to scan when multiple previews are open

The first release should present preview controllers through a host-side dock with embedded windows/cards.

For v1, the baseline should stay deliberately simple:

1. docked cards/windows
2. expand/focus/close actions
3. optional collapse
4. stable ordering

Do not treat a full draggable desktop-style window manager as part of the minimum release-quality scope.

Detached windows should remain a valid future presentation mode, but they must reuse the same controller launch contract and session model instead of becoming a second preview architecture.

The preview chrome should show only what matters:

1. player label or seat label
2. connection state
3. open/focus action
4. collapse/expand action
5. close action

### Real Controller Surface Rule

When expanded/open, the preview should render the real controller UI through a host-managed preview surface.

For v1, that surface should be an embedded dock window/card.

Later, that same preview surface model may also support detached windows when the product benefits from multi-monitor or split-screen workflows.

Do not:

1. reimplement controller screens inside the preview manager
2. build fake mini-controllers that drift from the real route

## Scope

## Phase 1 Scope

The first release-quality version should include:

1. host-side preview-controller dock
2. spawn one or more real preview controllers into the current room
3. docked embedded preview cards/windows with compact and expanded states
4. a real controller route loaded inside each preview surface, with docked embedded rendering as the v1 implementation
5. clean join/leave lifecycle
6. support mixing preview and phone controllers in one room

## Phase 1 Non-Goals

The first version should not include:

1. a complete desktop simulation system
2. alternate controller control schemes just for preview
3. preview-specific game behavior
4. preview recording/replay
5. persistent preview seat restore across page reloads
6. unlimited controller count
7. a feature-heavy draggable desktop window manager

## Surface Consumers

### 1. First-Party Platform

The feature should be available on:

1. Arcade/play surfaces where quick tryout matters
2. preview surfaces where a creator or reviewer wants to test rapidly

### 2. Scaffolded Games

The feature should also be available in generated or repo-owned host flows so developers can use it without the platform.

That is required for the feature to be honest as a core devex improvement instead of only a first-party product enhancement.

## Default Enablement Policy

The clean default is:

1. enabled by default in regular local development
2. not enabled by default in production builds
3. available as an explicit product decision where public quick-try matters

### Dev Default

In local dev, the preview dock should be present by default on host surfaces for:

1. repo-owned games
2. scaffolded `create-airjam` games
3. local platform play/test surfaces where it improves iteration speed

This is the main developer-experience goal, so it should not require extra setup in the normal local path.

### Production Default

Production should remain explicit.

That means:

1. standalone exported or scaffolded games should not automatically expose the preview dock in production
2. repo-owned games should opt in deliberately if they want public desktop quick-try
3. platform surfaces can enable it selectively where product funnel value is worth it

This avoids baking a public product decision into every shipped Air Jam host by default.

### First-Run Scaffold Expectation

The expected first-run local experience for generated games should be:

1. run the normal host dev command
2. open the host page
3. see a small `Add controller` entry point immediately
4. spawn a real preview controller with one click
5. still allow phone controllers to join the same session normally

### Ownership Of This Default

This defaulting policy should live at the host integration layer, not as hidden runtime behavior.

That means:

1. the shared preview module stays reusable and explicit
2. scaffold templates mount it automatically in dev
3. production enablement is controlled by host code or explicit config
4. SDK core should not silently auto-mount preview UI

## Integration Strategy

This should be integrated in a way that avoids copy-paste between platform and scaffolded games.

Preferred direction:

1. one reusable preview-controller session and launch layer
2. thin platform integration
3. thin scaffold integration

The reusable layer should expose host-facing primitives such as:

1. preview controller manager state
2. spawn/remove actions
3. preview controller launch/render helpers
4. first-party dock components or dock primitives

It should not pull platform-only dependencies into the reusable layer.

## Code Reality And Architecture Lock

After checking the current runtime and platform code, the clean architecture is clearer than the first draft.

Observed code facts:

1. `useAirJamHost()` already exposes the canonical controller entry point through `host.joinUrl` and `host.joinUrlStatus`
2. standalone controller routes already support normal room join through URL params and can also accept an explicit `controllerId`
3. the platform controller page is already a real controller client that then loads the active game controller UI inside its own shell
4. the platform host/game embed path already has one reusable iframe-launch helper, but preview controllers do not yet have an equivalent host-facing launcher abstraction

That means the preview dock should not invent a second controller path.

The preview dock should launch the canonical `host.joinUrl` itself.

### Clean Runtime Model

Each preview controller should be launched like this:

1. host runtime resolves `host.joinUrl`
2. preview dock generates a fresh preview controller identity
3. preview dock augments the canonical join URL with explicit preview controller params
4. a preview surface loads that URL as a normal controller client
5. closing that surface lets the controller disconnect through the existing runtime lifecycle

This keeps preview controllers as ordinary controller clients instead of bridge-only special cases.

For v1, the preview surface should be an iframe inside the host dock.

Future detached windows should be treated as another host-local presentation target for the same launch flow, not as a separate runtime mode.

### Why This Is Cleaner

This model works across both major consumers:

1. standalone and scaffolded games can load their own real `/controller` route inside a host-managed preview surface
2. platform surfaces can load the real platform `/controller` page, which then keeps using its existing controller shell and inner game-controller loading model

That is the right kind of reuse because both consumers share the same join contract instead of sharing platform-only implementation details.

## Module Boundaries

The cleanest ownership is an optional SDK leaf module, not a new core runtime contract and not a platform-only implementation.

Preferred placement:

1. keep SDK core unchanged as the owner of room, controller, host, input, state, and signal primitives
2. add a new optional leaf export such as `@air-jam/sdk/preview`
3. keep platform-specific controller page behavior inside the platform app
4. keep scaffold usage as a thin consumer of the preview leaf module

Why this is preferable to a brand-new package:

1. scaffolded games already depend on `@air-jam/sdk`
2. the feature is tightly coupled to SDK host/controller contracts
3. a leaf export keeps the surface modular without adding another package and release track

## Reusable Preview Layer

The shared preview layer should own only host-local concerns.

It should contain:

1. a preview controller URL helper that starts from canonical `host.joinUrl`
2. preview controller identity-isolation helpers
3. preview controller manager state
4. spawn, close, focus, and basic ordering actions
5. reusable preview surface launch/render helpers
6. dock components or dock primitives
7. local persistence only if later proven worth it, not in v1

It should not contain:

1. platform controller-shell logic
2. game-specific preview behavior
3. any replicated state or authority over room/game state
4. fake input forwarding or host-side controller emulation
5. a heavyweight generic window-manager abstraction

## Preview URL Contract

The preview dock should never hand-assemble ad hoc controller URLs in app code.

It should use one reusable helper that:

1. accepts canonical `host.joinUrl`
2. appends an explicit `controllerId`
3. appends preview-only reserved params when needed
4. preserves the existing controller capability token from the join URL

Suggested first-version reserved params:

1. `controllerId` for stable explicit preview-controller identity
2. `aj_preview=1` so controller shells can detect preview-surface mode when needed
3. a reserved explicit preview device identifier if we decide to isolate preview clients from shared same-origin preview storage in the initial implementation

## Required Refactors

This feature is clean only if we do a few targeted refactors first instead of layering it onto the current code as host-specific glue.

### Refactor 1. Platform Controller Page Split

Current issue:

1. `apps/platform/src/app/controller/page.tsx` currently mixes controller runtime ownership, outer chrome, fullscreen/menu UX, fallback remote controls, and inner game-controller iframe loading
2. preview mode will need the real runtime path but not necessarily all of that outer product chrome in either docked or detached presentation

Required change:

1. split the page into a reusable runtime shell and smaller platform presentation pieces
2. separate controller runtime bootstrap, embedded game-controller frame/bridge, and outer product chrome
3. allow preview mode to suppress or simplify fullscreen prompts, menu affordances, and other wrapper behavior that does not belong inside a compact preview surface

This should remain a platform refactor, not a reusable preview-module responsibility.

Current progress:

1. completed on 2026-04-09
2. `apps/platform/src/app/controller/page.tsx` now acts as a thin runtime/search-param wrapper
3. the embedded controller iframe/bridge lifecycle now lives in `use-controller-embedded-game-frame.ts`
4. outer platform presentation now lives in `controller-page-layout.tsx`
5. preview-surface mode now exists and suppresses fullscreen/menu chrome without introducing a second controller runtime path

### Refactor 2. Canonical Preview Controller URL Helper

Current issue:

1. host-side code has no shared helper for launching preview controller clients from the canonical join URL
2. this would otherwise get rebuilt differently in platform and scaffold consumers

Required change:

1. add one reusable preview URL builder in the shared preview module or shared URL helpers
2. make all consumers use that helper instead of assembling params inline

Current progress:

1. completed on 2026-04-09 through the new `@air-jam/sdk/preview` leaf export
2. the canonical helper now starts from `host.joinUrl`, preserves existing join params, adds explicit preview controller identity, and appends `aj_preview=1`
3. the helper can optionally reject launches outside an allowed origin set so embedded preview consumers can stay strict when needed

### Refactor 3. Preview Identity Isolation

Current issue:

1. multiple same-origin preview surfaces will otherwise share controller local-storage state
2. explicit `controllerId` is enough for basic concurrent joins, but identity isolation is cleaner if preview clients do not rely on shared room binding or shared device identity

Preferred change:

1. support an explicit preview device-identity override for preview-launched controller clients
2. have the preview launcher provide that identity instead of relying fully on controller local storage

This is a small runtime hardening refactor and should stay narrow.

Current progress:

1. in progress on 2026-04-09
2. preview launches now have a reserved preview device identity contract via `aj_preview_device`
3. the controller runtime now prefers that preview device identity over persisted local device storage when present
4. concurrent preview-session behavior still needs direct launch-path integration and validation

## State Ownership Rule

The preview dock is host-local UI state only.

That means:

1. dock visibility, layout, z-order, and collapse state are not replicated
2. preview windows do not live in gameplay stores
3. the room/session remains authoritative only through the normal host/controller runtime
4. closing or rearranging preview windows must never affect the host session model beyond normal controller disconnects

## Presentation Mode Rule

Preview presentation modes are host-local UX choices, not runtime modes.

That means:

1. docked embedded previews and detached preview windows should share the same controller launch contract
2. the controller session model must stay identical regardless of where the surface is rendered
3. popup, multi-monitor, or Studio desktop presentation should be progressive enhancements over the same preview primitives
4. browser window-management limits should not leak into gameplay or room contracts

## First-Version Limits

To keep the feature polished and reliable, v1 should stay intentionally small.

Recommended limits:

1. default quick-add count of one controller
2. visible concurrent preview cap of `2` by default
3. hard cap of `4` unless real testing proves a higher count is still clean

If the platform controller path ends up nesting platform controller iframes that then load game-controller iframes, that is acceptable for the docked v1 implementation as long as the capped count performs well.

## Game Compatibility Contract

Repo-owned and scaffolded games should not need special preview support in gameplay code.

Compatibility requirements:

1. existing controller routes should continue to work unchanged
2. no game-specific preview mode should be required
3. preview controllers must interact through the normal input/state/signal lanes

If a game breaks under preview controllers, that should usually be treated as a sign that the game was relying on an accidental assumption about controller origin.

## Visual Quality Direction

The dock should feel professional and product-grade.

That means:

1. calm and minimal
2. clear hierarchy
3. no debug-tool ugliness
4. no giant intrusive developer panel by default
5. easy to use with mouse and trackpad

The preview system should look like a polished host-side accessory, not a temporary internal testing widget.

## Risk Management

### Main Risks

1. accidentally creating a second controller path
2. overcomplicating preview identity/lifecycle
3. building platform-specific logic that generated games cannot reuse
4. adding too much window-management complexity before the core flow is proven

### Mitigations

1. force preview controllers to use the real controller route
2. keep first-version session lifecycle simple
3. separate reusable preview logic from platform-only shell integration
4. keep the first dock minimal and polished instead of feature-heavy

## Execution Workstreams

### Workstream A. Product Contract

1. lock the exact host-side UX
2. define preview controller count limits
3. define default states: compact, expanded, close behavior
4. define where the feature appears before release

Done when:

1. the v1 product behavior is unambiguous

### Workstream B. Reusable Preview Runtime Layer

1. create the reusable preview-controller session and launch layer
2. ensure preview controllers use the real controller route
3. ensure preview and phone controllers can coexist in one room
4. keep host/session topology unchanged

Done when:

1. the feature works without platform-specific assumptions

Current progress:

1. the shared preview runtime contract now exists under `@air-jam/sdk/preview`
2. canonical preview launch URL generation is shared
3. host-local preview session state now exists as a reusable manager hook
4. the shared preview surface and first dock presentation now also live under `@air-jam/sdk/preview`
5. the shared host wrapper now exists so standalone hosts do not need to hand-derive preview join state
6. live mixed-session proof now passes on a standalone host with one preview controller plus one phone-style controller in the same room
7. preview close and reopen now also behave correctly in that live room proof, with a fresh preview identity on reopen
8. live Arcade proof now also passes on the platform path, including QR/controller-link coexistence, preview dock coexistence, and one phone controller joining the same room after the embedded-controller runtime-origin fix
9. the first-use desktop-width pass now also holds at 1440, 1100, and 960 wide without losing the QR/controller-link or `Add controller` affordance
10. this plan is now complete enough to leave the active prerelease implementation surface

### Workstream C. Platform Controller Refactor

1. split the platform controller page into cleaner layers
2. preserve the normal full controller product behavior
3. expose a compact preview-surface mode without baking preview logic into the shared runtime layer

Done when:

1. platform integration can stay thin because the controller page is no longer one oversized mixed-responsibility component

### Workstream D. Platform Integration

1. integrate preview controllers into the relevant platform host surfaces
2. keep public tryout UX clean
3. ensure preview windows do not fight existing Arcade chrome

Done when:

1. platform consumers get the feature as a thin integration over the shared layer

Current progress:

1. the platform now mounts a first docked preview-controller accessory in both `/arcade` and `/play`
2. the dock stays host-local and consumes the shared SDK preview manager instead of building app-local launch logic
3. the shared runtime path is already proven in a live standalone mixed-session room
4. live Arcade proof now also passes after fixing the embedded-controller runtime-origin bug, with one preview controller and one phone controller coexisting in the same room
5. the first-use desktop-width pass now also holds on the Arcade path at 1440, 1100, and 960 wide
6. this workstream is now complete

### Workstream E. Scaffold Integration

1. integrate preview controllers into the scaffolded host experience
2. keep setup minimal for generated projects
3. make the dev path obvious without teaching a second architecture

Done when:

1. scaffolded games get the same fast-try benefit as platform games

Current progress:

1. all five launch-set repo host flows now mount the shared host preview dock in local dev
2. all five scaffold launch hosts now mount that same shared host preview dock in local dev
3. the abstraction is no longer only proven by platform or one standalone game
4. standalone mixed-session behavior is now proven in a real local host flow
5. remaining work is documentation and final platform-surface validation rather than more rollout

### Workstream F. Validation

1. verify mixed sessions with phone and preview controllers
2. verify join/leave correctness
3. verify no special-case gameplay logic is needed
4. verify responsive and interaction quality of the dock itself

Done when:

1. the feature is trustworthy in both product and dev workflows

## Phase Plan

### Phase 0. Product And Architecture Lock

1. finalize the host UX and v1 scope
2. finalize ownership and topology rules
3. finalize where the feature appears before release

### Phase 1. Shared Preview Runtime

1. split the platform controller page into reusable runtime/presentation layers
2. build the shared preview URL and identity contract
3. prove the minimal preview session launch path

### Phase 2. Platform Integration

1. build the shared preview session layer and first dock presentation
2. integrate into Arcade/play surfaces
3. keep public tryout UX polished and minimal

### Phase 3. Scaffold Integration

1. integrate into scaffolded host flows
2. update scaffold defaults and docs as needed

### Phase 4. Polish And Validation

1. compact/expanded dock polish
2. join/leave and multi-controller validation
3. targeted UX review for first-use quality

## Implementation Checklist

This checklist is the concrete execution order for the first clean implementation.

### 0. Prerequisite Contract Lock

- [x] Confirm the shared placement as an optional SDK leaf module such as `@air-jam/sdk/preview`
- [x] Confirm the defaulting rule: enabled by default in local dev, opt-in in production
- [x] Confirm the first-version controller count cap and compact/expanded dock scope
- [x] Confirm the preview URL contract and reserved params

Done when:

1. no implementation step depends on unresolved ownership or product-default questions

### 1. Platform Controller Page Refactor

- [x] Split `apps/platform/src/app/controller/page.tsx` into smaller reusable layers
- [x] Separate controller runtime ownership from outer product chrome and menu UX
- [x] Extract the embedded game-controller frame/bridge path into cleaner platform-local pieces
- [x] Add a clean preview-surface mode that suppresses chrome not suitable for compact docked previews
- [x] Preserve the normal full controller product behavior outside preview mode
- [x] Keep all platform-only behavior inside the platform app

Done when:

1. platform preview consumers can reuse the real controller path cleanly
2. the page no longer acts as one oversized mixed-responsibility component

### 2. Shared Preview URL Builder

- [x] Add one canonical helper that starts from `host.joinUrl`
- [x] Make it append explicit preview controller identity without rebuilding the base join logic
- [x] Preserve existing capability-bearing join params from `host.joinUrl`
- [x] Add support for explicit preview-only reserved params such as `aj_preview=1`
- [x] Add tests for URL composition and invalid-origin rejection behavior

Done when:

1. all preview consumers can build controller-launch URLs through one shared helper
2. no app code is hand-assembling preview controller URLs

### 3. Preview Identity Isolation

- [x] Decide the minimal explicit identity inputs needed for preview controllers
- [x] Add narrow controller-runtime support for preview identity override where required
- [x] Ensure concurrent same-origin preview surfaces do not collide through shared local-storage identity
- [x] Keep this override path limited to preview use instead of widening general controller complexity
- [x] Add automated launch-layer tests for concurrent preview controller identities
- [x] Complete live mixed-session proof for concurrent preview-controller joins in one room

Done when:

1. multiple preview controllers can join from one desktop host page without identity collisions
2. closing and reopening previews behaves predictably

### 4. Shared Preview Session Layer And Dock

- [x] Add host-local preview controller manager state
- [x] Add spawn, close, focus, and basic ordering actions
- [x] Add the preview dock UI
- [x] Add compact and expanded preview card/window components
- [x] Keep layout state local to the host page and out of replicated/gameplay state
- [x] Keep the visual treatment minimal and product-grade
- [x] Avoid a heavyweight general window-manager abstraction in v1

Done when:

1. a host surface can render and manage preview controllers without platform-specific code

### 5. Shared Preview Surface

- [x] Add the reusable preview surface component and launch abstraction
- [x] Implement docked embedded rendering as the first supported surface target
- [x] Ensure the v1 surface loads the real controller route, not a fake preview UI
- [x] Add loading, failed-load, and disconnected states that stay visually clean
- [x] Add close behavior that results in a normal controller disconnect
- [x] Verify that preview windows can coexist with real phone controllers in the same room

Done when:

1. preview surfaces are just host-managed containers around real controller clients

### 6. Platform Integration

- [x] Add the preview dock to the chosen Arcade/play surfaces
- [x] Place the `Add controller` entry point where it is visible but not intrusive
- [x] Verify preview windows do not fight Arcade chrome, QR, or fullscreen flows
- [x] Verify mixed sessions with preview and phone controllers in a live Arcade room

Done when:

1. platform users get the feature through thin integration over the shared layer

### 7. Scaffold And Repo-Game Integration

- [x] Mount the preview dock by default in normal local dev host flows for scaffolded games
- [x] Mount the preview dock by default in normal local dev host flows for repo-owned games where applicable
- [x] Keep production disabled by default unless the host explicitly opts in
- [x] Update scaffold defaults so first-run local host pages expose `Add controller` without extra setup
- [x] Avoid copy-paste platform code in standalone consumers

Done when:

1. generated games get the fast-try loop automatically in local dev
2. production remains an intentional product choice

### 8. Documentation

- [x] Update scaffold docs and generated docs for the new local host experience
- [x] Document the production opt-in behavior clearly
- [x] Document the non-goal that preview controllers are not a second topology or simulator
- [x] Document any public API added under the shared preview module

Done when:

1. the feature is teachable without explaining internal platform details

### 9. Validation And Release Gate

- [x] Run relevant SDK typecheck, test, and build paths
- [x] Run relevant platform typecheck and build paths
- [x] Run scaffold validation after template updates
- [x] Manually verify one standalone/scaffold host flow
- [x] Manually verify one platform Arcade/play flow
- [x] Manually verify mixed preview and phone-controller sessions
- [x] Manually verify preview close/reopen behavior
- [x] Manually verify the first-use UX on desktop widths we care about

Done when:

1. the feature is proven in both developer and product-facing flows

## Validation Contract

Minimum validation before calling this prerelease-ready:

1. verify preview controllers can join a live room
2. verify preview and phone controllers can coexist in one session
3. verify closing a preview removes that controller cleanly
4. verify generated/scaffolded games can use the feature without special game code
5. run relevant typecheck, test, and build paths for touched packages/apps
6. run at least one real product flow and one local-dev flow manually

## Exit Criteria

This plan is complete when:

1. preview controllers exist as a real reusable feature
2. they use the real controller runtime and same session model
3. they work in both platform and scaffolded game flows
4. they can mix with real phone controllers in one room
5. the UX is polished enough to feel release-worthy, not internal-only

## Current Recommendation

This is a strong prerelease feature if it stays disciplined.

The right version is:

1. shared optional preview-controller session and launch layer
2. same session model
3. same controller route
4. a simple docked-card presentation for v1, not a feature-heavy window manager
5. thin platform and scaffold integrations
6. a reusable preview-surface model that can later support detached windows without changing runtime contracts

Release gate:

1. if this feature is not clearly done before the final manual prerelease check begins, cut it from v1 instead of carrying a half-productized preview path into release

The wrong version is:

1. platform-only one-off preview logic
2. fake local controller simulation
3. separate topology
4. too much custom preview-only behavior

The plan should follow the first path only.
