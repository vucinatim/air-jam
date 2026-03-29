---
name: controller-ui
description: Use when building or reviewing Air Jam controller surfaces so touch controls stay simple, readable, and game-appropriate instead of drifting into dense web-app UI patterns.
---

# Controller UI

Use this skill for controller gameplay and lobby surfaces.

## Read First

1. `docs/generated/controller-ui.md`
2. `docs/visual-system.md`
3. `docs/iconography.md`

## Gameplay Rules

1. gameplay controller UI should live inside an absolute `inset-0` root
2. avoid scroll during active gameplay
3. use large touch targets
4. disable accidental text selection
5. keep actions obvious and single-purpose

## Lobby Rules

1. keep the flow simple
2. allow scroll only when it helps
3. keep the hierarchy sparse

## Design Direction

1. build controller UI like a game control surface
2. avoid card-heavy dashboards
3. avoid tiny controls and dense text
4. avoid emoji-as-icon UI
5. if the template already defines semantic panel, shell, or touch-surface utilities, use those before inventing new visual patterns

## Icon Rule

Prefer:

1. `@tabler/icons-react` for general UI and system actions
2. `react-icons` `Gi*` exports for gameplay-specific concepts such as abilities, status effects, pickups, and damage types

Do not mix icon packs casually throughout the tree.

Prefer local wrapper modules so icon usage stays curated and replaceable.

## Attribution Note

If the project uses `react-icons` `Gi*` icons, remember that the underlying Game Icons set has its own attribution requirements.

Downstream teams remain responsible for how they satisfy those requirements.

## Anti-Patterns

1. generic SaaS UI for active gameplay
2. hard-coded desktop-like layouts on mobile
3. nested control groups that hide or shrink the main action
