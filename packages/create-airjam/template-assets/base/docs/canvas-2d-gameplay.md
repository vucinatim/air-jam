# Canvas 2D Gameplay

This guide exists for Air Jam projects that render gameplay in 2D on canvas.

The goal is to keep 2D games structured like games, not like DOM-heavy mini websites.

## Render Layer Rule

Use canvas for gameplay rendering.

Use React and normal UI modules for:

1. menus
2. HUD wrappers
3. overlays
4. controller and host shell chrome

Do not use the DOM as the main gameplay scene graph unless the game is genuinely UI-native.

## Separation Rule

Keep these concerns separate:

1. simulation and game state
2. drawing and visual presentation
3. shell UI and overlays
4. input interpretation

Canvas code should not become the place where all game logic lives.

## Scaling Rule

Keep world coordinates distinct from:

1. canvas pixel dimensions
2. CSS layout dimensions
3. device pixel ratio

This makes camera, zoom, hit areas, and responsive scaling much easier to reason about.

## Asset Direction

LLM-generated SVGs can work well for:

1. icons
2. pickups
3. simple props
4. UI symbols
5. stylized sprite inputs

But they should still be curated.

Rules:

1. keep a consistent stroke/fill language
2. normalize sizing and viewBox conventions
3. avoid mixing unrelated visual styles casually

## Animation And Effects

Prefer simple readable motion over overproduced effect stacks.

Use:

1. clean tweens
2. lightweight particles
3. readable squash, stretch, flash, or trail effects

Only add more visual complexity if the base game already reads well.

## Movement And Collision

For many 2D Air Jam games, a custom movement/collision model is the cleanest choice.

Use that first for:

1. simple arcade motion
2. constrained arenas
3. overlap-driven pickups
4. deterministic authored interactions

Only adopt a dedicated physics engine when the mechanic clearly benefits from it.
