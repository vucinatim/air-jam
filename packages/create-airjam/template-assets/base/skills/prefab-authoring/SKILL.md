---
name: prefab-authoring
description: Use when creating reusable gameplay objects or scene presets so prefabs stay declarative, configurable, and ready for future tooling such as previews and scanned catalogs.
---

# Prefab Authoring

Use this skill when adding reusable scene objects, pickups, obstacles, props, spawnable entities, or authored content presets.

## Read First

1. `docs/prefab-authoring.md`
2. `docs/generated/project-structure.md`
3. `docs/generated/state-and-rendering.md` if the prefab introduces hot runtime behavior

## Contract Rule

A prefab should be a reusable content unit, not a hidden pile of gameplay logic.

Keep the prefab definition declarative and stable enough that future tooling can:

1. scan it
2. render a preview
3. expose safe config
4. instantiate it consistently

## Structure Rules

1. place prefab code under `src/game/prefabs/`
2. keep metadata, schema, and runtime component clearly separated
3. put pure behavior in domain/system modules when it outgrows the prefab itself
4. avoid coupling prefab definitions directly to scene-global mutable state
5. keep scene-population, spawn, and pooling layers outside `src/game/prefabs/`

## Config Rules

1. expose explicit defaults
2. keep config serializable where practical
3. use stable ids, labels, categories, and tags
4. avoid hidden magic props or implicit scene dependencies

## Anti-Patterns

1. one-off scene objects masquerading as reusable prefabs
2. prefab files that bury behavior, metadata, and config in one component
3. prefab placement rules that depend on trial-and-error offsets
4. prefab contracts that are too ad hoc for future scanning or preview generation
5. plural runtime mappers like `Ships` or `Collectibles` living in `src/game/prefabs/` when they are actually population layers over state
