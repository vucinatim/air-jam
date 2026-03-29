---
name: canvas-2d-gameplay
description: Use when building or reviewing a 2D Air Jam game with canvas so simulation, rendering, SVG/sprite assets, scaling, and collision stay clean instead of collapsing into DOM-heavy ad hoc logic.
---

# Canvas 2D Gameplay

Use this skill for 2D gameplay rendered on canvas.

## Read First

1. `docs/canvas-2d-gameplay.md`
2. `docs/generated/state-and-rendering.md`
3. `docs/generated/project-structure.md`

## Core Rule

Use canvas as the gameplay render surface, and keep React/DOM for shell UI and overlays.

Do not try to run the whole game through DOM layout.

## Structure Rules

1. keep simulation separate from drawing
2. keep world coordinates separate from screen and CSS coordinates
3. keep HUD and menus in reusable UI modules above the canvas
4. keep input interpretation out of the render code

## Asset Rules

1. LLM-generated SVGs are fine for icons, pickups, simple props, and UI art if they are cleaned up and curated
2. keep a consistent visual language across sprites, SVGs, and UI
3. prefer a small curated asset set over random mixed-generation output

## Movement And Collision Rule

For most 2D games, prefer simple custom movement and collision before reaching for a heavyweight physics layer.

Add a physics engine only when the mechanic truly needs it.

## Anti-Patterns

1. gameplay logic buried inside draw calls
2. DOM elements used as the main simulation surface
3. inconsistent scaling between world units and canvas pixels
4. random SVGs with mismatched stroke, color, and perspective language
5. overcomplicated physics for simple arcade movement
