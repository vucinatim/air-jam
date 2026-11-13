<!-- Generated from content/docs/for-agents/controller-ui/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://airjam.io/docs/for-agents/controller-ui -->

# Controller UI

Controller UI should feel like a game controller first and a webpage second.

The main failure mode is borrowing desktop web-app patterns for active gameplay surfaces.

## Gameplay Controller Rules

A game whose `inputModalities` include `'joystick'` always gets a landscape controller; the SDK applies it, so do not set orientation; lay it out with `GamepadLayout` from `@air-jam/sdk/ui`: the stick under the left thumb, the main action under the right, both the same size, and only short status between them.

For active gameplay:

1. use an absolute `inset-0` root
2. avoid scroll
3. disable accidental text selection
4. use large touch targets
5. keep controls visually obvious and single-purpose
6. minimize text and dense hierarchy

## Sideways Controllers

A sideways phone is held like a gamepad, so its controls use the screen like one. Compose them in `GamepadLayout`:

1. the stick goes in `left` and the main action in `right`; both fill the same square, so they carry the same weight and mirror each other about the centre, each centred in its thumb zone on one line
2. `center` holds only what a player reads at a glance: a round, a number, a word, a few icons; it never wraps into squeezed lines
3. a longer message goes in the header bar above the layout, or stays on the TV
4. a second action shares the right zone with the main one, smaller, rather than starting a third column

```tsx
import { ControlButton, GamepadLayout, Stick } from "@air-jam/sdk/ui";

// Before: a big stick, a small button pushed to the edge, a sentence wrapping between them.
<div className="flex h-full items-center justify-between px-6">
  <Stick control={gameInput.move} className="size-56" />
  <p className="max-w-48 text-2xl">Splash! Back next round</p>
  <ControlButton control={gameInput.dash} className="size-28">Dash</ControlButton>
</div>

// After: equal mirrored thumbs, a glanceable centre, the sentence in the header.
<GamepadLayout
  left={<Stick control={gameInput.move} className="rounded-full bg-white/10" />}
  center={<span className="text-xs uppercase">Round 1</span>}
  right={<ControlButton control={gameInput.dash} className="rounded-full bg-sky-400">Dash</ControlButton>}
/>
```

## Lobby Rules

Lobby screens can be slightly more flexible, but should still prefer:

1. simple layout
2. large controls
3. minimal friction
4. scroll only when it actually helps the flow

## Interaction Rules

Avoid:

1. tiny toggles
2. multi-purpose buttons with unclear affordance
3. deeply nested control groups
4. layouts that assume precise pointer interaction

## Visual Rules

Prefer:

1. sparse game-like hierarchy
2. fluid layout over hard-coded widths and heights
3. obvious action grouping
4. strong contrast and immediate readability

Avoid:

1. card-heavy dashboard styling for active gameplay
2. emoji-as-icon UI
3. cluttered web-app chrome

## Icon Rule

For template and starter work, a practical split is:

1. a general UI and system icon pack for shell actions
2. a gameplay-oriented icon set for abilities, pickups, and status effects

Keep icon usage behind local wrappers where practical so the project can curate or replace icons later.
