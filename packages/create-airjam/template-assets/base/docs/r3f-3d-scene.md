# R3F 3D Scene

This guide exists for Air Jam projects that use React Three Fiber for host-side gameplay.

The goal is not just to "make Three.js work".

The goal is to keep 3D scenes readable, performant, and authored with stable conventions so LLMs do not create visual chaos.

## Render Layer Rule

Treat R3F as the scene and rendering layer.

Keep:

1. gameplay rules in domain/system modules
2. orchestration in engine/adapters
3. scene composition, cameras, lights, and materials in the 3D layer

## Lighting Baseline

Establish one clean baseline lighting setup early.

For many stylized scenes, that usually means:

1. one main directional light that defines form and shadows
2. one ambient or hemisphere contribution so shadows are not dead black
3. one environment or sky source that gives the whole scene a coherent fill

Do not keep stacking random lights until the scene looks acceptable.

## Shadows

Three.js shadows often fail because the shadow camera bounds do not match the actual play area.

Rules:

1. enable shadows only on lights and meshes that matter
2. tune the directional light shadow camera to the real gameplay footprint
3. avoid gigantic catch-all shadow bounds
4. verify the play area fits inside the shadow frustum during active gameplay

If shadows look clipped, low-detail, or unstable, fix the shadow camera first before raising map sizes blindly.

## Grounding And Placement

Models should have a clear grounding convention.

Do not solve floating props with random hand-tuned offsets in every scene.

Instead:

1. define the ground plane or gameplay floor height
2. define each prefab's origin and intended contact point
3. keep reusable placement helpers for grounding and bounds

This matters for props, pickups, vehicles, characters, and spawnables.

## Physics

Rapier is a good default when the game genuinely needs:

1. rigid-body motion
2. stacking or collision response
3. reliable intersection/cast queries
4. authored physics interactions that are easier to express with a solver

Prefer custom movement/collision when:

1. objects move on simple constrained planes
2. collision is mostly overlap or tile/shape based
3. the game wants deterministic arcade behavior more than simulation fidelity

Do not pay the complexity cost of a full physics engine without clear benefit.

## Particles And Effects

Use particles to reinforce motion, impacts, pickups, or atmosphere.

Do not use them as noise.

Rules:

1. keep them isolated in effect modules or systems
2. tie them to concrete gameplay events
3. keep spawn counts and lifetime intentional

## Materials, Textures, And Shaders

Prefer a coherent material language over random defaults.

Use:

1. curated textures when they actually improve readability
2. generated textures when the style is controlled and repeatable
3. custom shaders when the mechanic or visual identity truly needs them

Avoid introducing shader complexity just to make a weak base scene look more advanced.
