# Landing, Arcade, and Controller Polish Plan

Last updated: 2026-05-03  
Status: planned release polish  
Owner: Codex + Tim

## Purpose

This plan captures the next bounded UI hardening pass across:

1. the public landing page
2. the public Arcade catalog and host shell
3. the controller shell
4. the shared platform settings surface

The goal is not generic polish. The goal is to remove misleading UI, fix the broken Arcade settings path, tighten public-facing catalog presentation, and make the landing page communicate the actual Air Jam product better.

## Why this plan exists

The product is now live enough that presentation problems matter. The current state has a few concrete issues:

1. the landing page is not showing the intended featured games
2. the “from prompt to playable” area is still underselling real Air Jam capabilities
3. Arcade still shows a visible scrollbar
4. the public-facing naming of `Minimal` is too vague
5. the code action in Arcade is missing the exact command affordance on hover
6. the controller chrome is wasting vertical space and splitting status awkwardly
7. the shared settings panel still exposes controls (`reduced motion`, `high contrast`) that do not provide meaningful behavior in this product state
8. the Arcade settings panel appears visibly present but functionally broken, which is worse than simply not having settings

This is exactly the kind of state that creates trust erosion if we leave it alone.

## Scope

In scope:

1. landing featured-game selection
2. landing capability prompt-cycler UX
3. Arcade scrollbar visibility cleanup
4. Arcade game naming cleanup for `Minimal Template`
5. Arcade developer-action tooltip behavior
6. controller top chrome layout cleanup
7. removal of dead or misleading settings controls
8. root-cause fix for Arcade settings interactivity
9. validation in the real deployed/browser-facing surfaces

Out of scope for this pass:

1. media generation or auto-capture workflows
2. deeper landing-page redesign beyond the targeted sections below
3. public catalog ordering strategy beyond the explicitly requested featured landing trio
4. a broader accessibility product pass
5. redesigning the entire controller sheet architecture unless the settings bug forces it

## Design principles for this pass

1. prefer small explicit data decisions over emergent ordering
2. do not leave placeholder controls in production UI
3. do not hide broken interaction behind styling tweaks
4. keep public-facing naming honest and self-explanatory
5. treat landing-page capability copy as product explanation, not decoration
6. keep Arcade and controller chrome dense, clear, and low-friction
7. keep room-owned and controller-local settings explicitly separated

## Settings Ownership Rule

This plan also owns the controller-settings ownership cleanup that was previously tracked separately.

The required product split is:

1. room / Arcade settings are host-owned and controller-edited remotely
2. controller comfort settings are controller-local and should not pretend to be room-owned

The implementation should preserve that boundary instead of keeping one ambiguous mixed settings bucket alive.

## Workstreams

### 1. Landing featured games

#### Goal

The landing page should feature:

1. `Last Band Standing`
2. `Code Review`
3. `The Office`

#### Current behavior

The landing page currently takes the first three public games from `game.getAllPublic`, which is an implicit ordering rule and not what we want.

#### Required change

Replace the current `slice(0, 3)` behavior with an explicit featured-game selection rule.

#### Preferred implementation

Use one of these two shapes:

1. a tiny explicit featured slug list in landing code:
   - `last-band-standing`
   - `code-review`
   - `the-office`
2. or a very small helper dedicated to landing featured ordering

Do not solve this with broad catalog configuration unless we actually need that elsewhere.

#### Acceptance criteria

1. the landing page always shows exactly those three games when they are present
2. the ordering is explicit and stable
3. absence of one game degrades gracefully without breaking the section

### 2. Landing “from prompt to playable” capability prompt-cycler

#### Goal

The landing page should show that Air Jam can do more than generate a first draft. It should demonstrate that the product can be used to inspect, debug, publish, and iterate from within a real Air Jam project.

#### Current behavior

The section has the video, but not the input/prompt affordance that makes the capability story concrete.

#### Required change

Add a small input-like prompt surface to the `LandingAgentDemo` section and cycle through concrete prompts that represent real Air Jam workflows.

#### Proposed prompt set

These should be short, credible, and operational:

1. `use Air Jam logs to debug this`
2. `publish this to my account`
3. `change the arcade preview image`
4. `update the preview video`
5. `play the game yourself and fix runtime bugs`
6. `release this as a hosted build`
7. `inspect the controller UI and fix layout issues`

#### UX intent

This should feel like a real operating surface, not a fake terminal. It should read as “this is the kind of command/request you can give inside a created Air Jam project.”

#### Acceptance criteria

1. prompt text cycles cleanly
2. the visual treatment reads as an input/request surface
3. it does not crowd the video or turn the section into a marketing gimmick

### 3. Arcade scrollbar visibility

#### Goal

Arcade should remain scrollable, but the scrollbar should not be visibly rendered.

#### Required change

Hide visible scrollbars in the Arcade browser while preserving:

1. wheel/trackpad scroll
2. touch scroll
3. controller-driven navigation

#### Acceptance criteria

1. no visible scrollbar in the Arcade browser on desktop
2. list still scrolls normally
3. controller navigation still works and still keeps the selected card visible

### 4. Public-facing naming for `Minimal`

#### Goal

The public catalog should make it obvious that `Minimal` is a template.

#### Required change

Display `Minimal Template` in public-facing Arcade/landing presentation.

#### Preferred implementation

Do this at the platform presentation layer first, not by mutating deeper internal identity unless needed.

This is a display concern, not a runtime identity concern.

#### Acceptance criteria

1. the public Arcade card reads `Minimal Template`
2. any landing/public catalog references also read `Minimal Template`
3. no release/runtime routing breaks due to display-name changes

### 5. Developer-action tooltip for the code icon

#### Goal

The code icon in Arcade should reveal the exact `create-airjam` command on hover.

#### Current behavior

The action exists, but the hover affordance does not expose the command inline.

#### Required change

Add a tooltip to the code action button that shows the generated template command for that game/template.

#### Acceptance criteria

1. hovering the code icon reveals the exact command
2. the tooltip is stable and readable
3. click-to-copy behavior still works
4. the tooltip does not interfere with clickability

### 6. Controller top chrome compression

#### Goal

The controller shell header should avoid wasting vertical space and should not wrap awkward status text onto a separate line.

#### Current issue

The current top chrome splits status/presence presentation too loosely and reads as heavier than it needs to.

#### Required change

Compress the presentation into a single line or a more icon-led layout.

#### Desired behavior

1. keep the room code clear
2. keep connection state understandable
3. remove the feeling of two stacked status rows
4. do not cram so much content into the line that it becomes noisy

#### Likely direction

Use the existing status dot more meaningfully and reduce status copy instead of adding more words.

#### Acceptance criteria

1. the top controller chrome reads as one compact row
2. room identity remains obvious
3. connection state is still understandable without extra vertical height

### 7. Remove dead settings controls

#### Goal

The shared settings panel should not expose controls that look real but do not matter.

#### Controls to remove

1. `Reduced motion`
2. `High contrast`

#### Reason

In the current product state these read like platform capabilities, but they are effectively placeholders and do not justify their presence.

#### Constraint

If these values are embedded deeply enough in the shared settings contract that removing them immediately would create unnecessary churn, we should still remove them from the visible production UI first and then decide whether to simplify the contract in the same pass or one follow-up pass.

#### Acceptance criteria

1. the shared settings panel no longer exposes these two controls
2. the remaining settings feel intentional
3. we do not leave dead UI with no runtime effect

### 8. Arcade settings interactivity bug

#### Goal

The Arcade settings panel must actually work.

#### Current observed behavior

In the Arcade shell:

1. volume controls are unresponsive
2. lower controls are not interactable
3. the panel is visible but not meaningfully usable
4. host-local/manual settings elsewhere appear to work, which suggests the bug is not in the basic settings model itself

#### Why this matters

A visible but broken settings panel is materially worse than no settings panel. It makes the surface feel fake.

#### Working theory

The likely failure is in one of these layers:

1. the Arcade shell is rendering the settings panel in a non-interactive layer or behind another pointer-capturing surface
2. the Arcade shell’s local settings store wiring is not actually live in this surface
3. the panel is getting correct values but not a working update path
4. a host-shell overlay/stacking/overflow decision is blocking input events

#### Debugging approach

1. inspect the Arcade settings trigger and panel render path in `ArcadeSystem`
2. inspect pointer-event and overlay stacking behavior around the settings panel and Arcade chrome
3. verify whether slider/toggle events fire at all in-browser
4. verify whether local settings state mutates if events are forced
5. verify whether the audio/settings runtime reacts when values change

#### Acceptance criteria

1. Arcade settings controls are clickable/draggable
2. volume sliders update state
3. remaining controls respond immediately
4. state changes visibly propagate in the Arcade shell

## Files and surfaces likely involved

### Landing

1. `/Users/timvucina/Desktop/MyProjects/air-jam/apps/platform/src/components/landing/landing-game-showcase.tsx`
2. `/Users/timvucina/Desktop/MyProjects/air-jam/apps/platform/src/components/landing/landing-agent-demo.tsx`
3. `/Users/timvucina/Desktop/MyProjects/air-jam/apps/platform/src/components/landing/landing-content.ts`

### Arcade

1. `/Users/timvucina/Desktop/MyProjects/air-jam/apps/platform/src/components/arcade/game-browser.tsx`
2. `/Users/timvucina/Desktop/MyProjects/air-jam/apps/platform/src/components/arcade/arcade-system.tsx`
3. `/Users/timvucina/Desktop/MyProjects/air-jam/apps/platform/src/components/arcade/arcade-chrome.tsx`
4. `/Users/timvucina/Desktop/MyProjects/air-jam/apps/platform/src/components/platform-settings-panel.tsx`
5. `/Users/timvucina/Desktop/MyProjects/air-jam/apps/platform/src/lib/arcade-game-mapper.ts`
6. `/Users/timvucina/Desktop/MyProjects/air-jam/apps/platform/src/server/api/routers/game.ts`

### Controller

1. `/Users/timvucina/Desktop/MyProjects/air-jam/apps/platform/src/components/controller-menu-sheet.tsx`
2. `/Users/timvucina/Desktop/MyProjects/air-jam/apps/platform/src/app/controller/controller-page-content.tsx`
3. `/Users/timvucina/Desktop/MyProjects/air-jam/apps/platform/src/app/controller/controller-page-layout.tsx`

### Shared settings contract

1. `/Users/timvucina/Desktop/MyProjects/air-jam/packages/sdk/src/settings/platform-settings.ts`
2. `/Users/timvucina/Desktop/MyProjects/air-jam/apps/platform/src/components/arcade/arcade-platform-settings-store.ts`

## Recommended execution order

1. fix Arcade settings interactivity first
2. remove dead settings controls
3. hide Arcade scrollbar and add code tooltip
4. rename `Minimal` to `Minimal Template` in public display
5. compress controller top chrome
6. switch landing featured games to the explicit trio
7. add the prompt-cycler/input affordance in the landing agent demo
8. run one full browser validation pass

## Validation checklist

### Landing

1. landing shows `Last Band Standing`, `Code Review`, and `The Office`
2. prompt-cycler rotates through the intended prompts
3. the section still reads clearly on desktop and mobile

### Arcade

1. no visible scrollbar
2. list still scrolls normally
3. code icon tooltip shows the exact command
4. `Minimal Template` displays correctly
5. settings panel opens and is fully interactive
6. volume controls can be dragged

### Controller

1. top chrome reads as one compact row
2. room code remains obvious
3. connection state remains understandable

## Open decisions

1. Should `Minimal Template` be only a display rename, or should the hosted game record itself also be renamed for consistency?
2. Should the settings contract itself drop `highContrast` and `reducedMotion`, or should we first remove them from UI and simplify the contract in a second pass?
3. Should featured landing games remain a landing-only decision, or should we later introduce a dedicated “featured” catalog field if we need it in more than one place?

## Completion bar

This plan is complete when:

1. the Arcade settings bug is actually fixed
2. the dead settings controls are gone
3. the landing and Arcade presentation changes are live
4. controller top chrome is denser and clearer
5. the browser validation pass confirms behavior on the real deployed surfaces
