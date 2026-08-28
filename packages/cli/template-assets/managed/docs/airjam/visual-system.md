# Visual System

Use this doc when extending the starter template's styling.

The goal is not to scatter one-off classes, arbitrary colors, and ad hoc gradients across the tree.

The goal is to keep the visual language intentional, reusable, and easy to evolve.

## Default Rule

When a template already ships a visual system:

1. extend the existing theme tokens first
2. extend the existing semantic utilities second
3. only then add one-off styling if the case is truly isolated

Do not bypass the shipped system casually.

## Tailwind Rule

For Tailwind CSS-first projects, prefer this order:

1. `@theme` for tokens such as colors, shadows, fonts, and reusable design values
2. `@layer base` for root, body, and element defaults
3. `@utility` for semantic reusable classes like stage shells, panels, status pills, and touch surfaces
4. inline utility classes in components for local composition

That keeps the styling model clear:

1. tokens define the palette and system values
2. semantic utilities define recurring UI primitives
3. component markup composes those primitives

## What Belongs In Tokens

Good token candidates:

1. brand or game palette colors
2. text colors and muted variants
3. shadows
4. type families
5. surface colors
6. border strengths

Bad token candidates:

1. one-off page-specific measurements
2. one component's temporary padding tweak
3. values that are only used once and have no system meaning

## What Belongs In Semantic Utilities

Good semantic utility candidates:

1. game shell backgrounds
2. host stage frames
3. reusable panel surfaces
4. status pills
5. touch control shells
6. overlay containers

Bad semantic utility candidates:

1. wrappers used by one element only
2. tiny spacing helpers that are really just local layout
3. utilities that hide unclear visual intent behind vague names

## Component Rule

Component files should mostly compose:

1. existing theme tokens
2. existing semantic utilities
3. local Tailwind classes for layout and spacing

Avoid:

1. repeating the same arbitrary color values in many components
2. rebuilding the same panel styling in multiple places
3. mixing several unrelated visual directions in one template

## Host And Controller Guidance

When the template has both host and controller surfaces:

1. keep one shared design language across both
2. let the host feel more atmospheric and stage-like
3. let the controller feel more tactile and action-first
4. keep gameplay controls simpler than lobby or status surfaces

Shared language does not mean identical layout.

## Decision Rule

Before adding styling, ask:

1. is this a token
2. is this a reusable semantic utility
3. is this only local composition

Put it at the highest level that is still honest.

If the answer is not clear, prefer local composition over premature abstraction.
