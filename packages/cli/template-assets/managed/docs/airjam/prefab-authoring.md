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

## Isolated assets and states

Prefabs are the catalog identity. Declare `space` and, for animated assets, named
`states`. Omitting states creates one static state (`static`). State time is in
seconds; the SDK owns playback and seeking, while the game draws that exact time.
A state without `seconds` is a static pose. `loop: true` wraps a timed state;
otherwise it pauses at the end.

```ts filename="src/airjam.config.ts"
import { defineAirJamGame } from "@air-jam/sdk/core";
import { createPrefabCatalog, definePrefab } from "@air-jam/sdk/prefabs";
import { z } from "zod";

export const dotProps = z.object({ radius: z.number().positive() });
export const dot = definePrefab({
  id: "dot",
  label: "Dot",
  category: "effect",
  description: "Pulsing circle",
  tags: ["effect"],
  space: "2d",
  configSchema: dotProps,
  defaultProps: { radius: 40 },
  states: [{ id: "pulse", label: "Pulse", seconds: 1, loop: true }],
});
// Add to your existing definition, retaining its metadata and other declarations:
export const game = defineAirJamGame({
  metadata,
  prefabs: createPrefabCatalog([dot]),
});
```

Keep this declaration module free of React and renderer imports. In the host
application, the stage selects the renderer for the declared prefab:

```tsx filename="src/prefab-stage.tsx"
import {
  createAirJamApp,
  drawAgentCanvas,
  useHostAgentCapture,
  usePrefabInspection,
} from "@air-jam/sdk";
import { resolvePrefab2DTransform } from "@air-jam/sdk/prefabs";
import { useLayoutEffect, useRef } from "react";
import { dot, dotProps, game } from "./airjam.config";

function Stage() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { prefab, props, time, view } = usePrefabInspection();
  if (prefab.id !== dot.id) throw new Error(`Unknown prefab: ${prefab.id}`);
  const { radius } = dotProps.parse(props);
  useHostAgentCapture((image, options) =>
    drawAgentCanvas(canvas.current, image, options),
  );
  useLayoutEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const { scale, translate } = resolvePrefab2DTransform(view, 512);
    context.resetTransform();
    context.clearRect(0, 0, 512, 512);
    context.translate(256 + translate[0], 256 + translate[1]);
    context.scale(scale, scale);
    context.beginPath();
    context.arc(
      0,
      0,
      radius * (1 + 0.2 * Math.sin(time * Math.PI * 2)),
      0,
      Math.PI * 2,
    );
    context.fillStyle = "#ff6a35";
    context.fill();
  }, [radius, time, view]);
  return <canvas ref={canvas} width={512} height={512} />;
}
const app = createAirJamApp(game);
// In the existing host route (LiveGame is your game's live component):
<app.Host prefabStage={Stage}>
  <LiveGame />
</app.Host>;
```

For R3F, use `resolvePrefabOrbitCamera(prefab.preview?.camera, view)` and apply its
`position`, `target` and `fov` to the game's camera. Capture through
`useHostAgentCapture`: render the R3F scene immediately before copying `gl.domElement`
with `drawAgentCanvas`, because WebGL drawing buffers need not survive a frame.
The helper has no Three dependency. Zoom 1 keeps default framing; yaw/pitch use
degrees relative to the preview camera. Pan uses fractions of view height, right/up
positive. The 2D helper returns pixel translation and scale around default framing;
yaw and pitch have no effect in 2D.

Open `?airjamInspect=1&prefab=dot&state=pulse&time=0.3` for a paused isolated frame.
Stages read parsed default props, state, time, playing and view from
`usePrefabInspection()`. They must draw only that prefab, without reading live room
stores, starting physics or advancing their own animation clock. The SDK reports
missing catalogs, missing stages and rendering errors. `@air-jam/sdk/prefab-inspection`
exports the validated parent client for lists, selection and batch canvas captures.
