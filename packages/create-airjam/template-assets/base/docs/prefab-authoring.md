# Prefab Authoring

Prefabs should be first-class reusable content units.

The goal is not just code reuse.

The goal is to make content predictable enough for future tooling to scan, preview, configure, and compose.

## What A Prefab Is

A prefab is a reusable gameplay or scene object with a stable contract.

Examples:

1. a tree, rock, wall, or prop
2. a pickup or spawn point
3. a vehicle or obstacle
4. a reusable gameplay actor shell

## Goals

Good prefabs should make it possible to:

1. reuse the same content definition in multiple scenes
2. expose safe configuration without rewriting component internals
3. generate previews later
4. scan the prefab directory and build a lightweight catalog

Each game should also expose one game-owned prefab catalog export so future
Studio or agent tooling has a single honest scan surface instead of searching
the whole codebase heuristically.

## Prefabs vs Scene Population

Do not mix these two concepts.

1. a prefab is a reusable authored content unit with a stable contract
2. scene population is the runtime or authored layer that places many prefab instances into a scene

Examples of scene population:

1. spawn one ship per connected player
2. render all collectibles from replicated store state
3. fill an arena with obstacle instances from a level layout

Those population or pooling layers should live outside `src/game/prefabs/`.

## Recommended Shape

Move toward a folder per prefab under `src/game/prefabs/`.

Example:

```text
src/game/prefabs/
  tree/
    prefab.ts
    tree.prefab.tsx
    tree.schema.ts
    tree.preview.ts
```

The exact filenames can vary, but the boundary should stay clear:

1. metadata and registry-facing contract
2. config schema and defaults
3. runtime render entry
4. optional preview descriptor

## Recommended Metadata

Each prefab should converge on stable fields like:

1. `id`
2. `label`
3. `category`
4. `description`
5. `tags`
6. `defaultProps`
7. `configSchema`
8. `render`
9. `preview`
10. `placement`

## Placement Rule

Prefab placement should be deterministic.

Do not rely on manual trial-and-error offsets that leave models floating, clipping, or inconsistently grounded.

If a prefab needs grounding logic:

1. define its origin clearly
2. define its footprint or bounds clearly
3. keep placement helpers reusable instead of baking ad hoc offsets into every scene

## Behavior Rule

Do not let prefabs become a dumping ground for full gameplay systems.

Use:

1. prefab files for reusable content assembly
2. domain or system modules for larger rules and behavior
3. adapters for engine or renderer integration
4. scene-population or pooling modules for multi-instance runtime ownership

## Decision Rule

If something is meant to be reused, previewed, or configured later, give it a prefab contract early.

If it is truly one-off scene glue, keep it out of the prefab layer.
