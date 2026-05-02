---
name: r3f-3d-scene
description: Use when building or reviewing a 3D Air Jam game with React Three Fiber so scene structure, lighting, shadows, grounding, particles, and physics stay deliberate instead of becoming ad hoc Three.js chaos.
---

# R3F 3D Scene

Use this skill for 3D host gameplay surfaces built with React Three Fiber and Three.js.

## Read First

1. `docs/r3f-3d-scene.md`
2. `docs/generated/state-and-rendering.md`
3. `docs/generated/project-structure.md`

## Core Rule

Treat R3F as a rendering layer.

Keep:

1. gameplay rules in domain/system modules
2. runtime orchestration in engine/adapters
3. scene composition and visual presentation in the 3D layer

## Scene Quality Rules

1. establish a deliberate lighting recipe early
2. define world origin, ground level, and object placement conventions clearly
3. keep shadows intentionally tuned to the actual play area
4. use particles and post effects as accents, not camouflage for weak art direction

## Physics Rule

Use Rapier when the game really benefits from rigid-body style simulation, collision response, or stacked interactions.

If gameplay only needs simple movement, overlap checks, or authored responses, prefer a lighter custom movement/collision model.

## Asset Rule

1. keep model scale and grounding consistent
2. prefer curated materials and textures over random defaults
3. use custom shaders only when they materially improve the look or mechanic

## Anti-Patterns

1. React state driving per-frame scene simulation
2. giant untuned shadow maps with clipped or blurry shadows
3. floating models fixed by random per-scene offsets
4. adding a full physics engine where simple authored logic would be clearer
5. piling on particles, bloom, or shaders before the base scene reads well
