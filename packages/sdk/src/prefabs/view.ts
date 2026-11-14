import { z } from "zod";
import type { PrefabPreviewDescriptor } from "./types";

export const prefabViewSchema = z
  .object({
    yaw: z.number().finite(),
    pitch: z.number().min(-89).max(89),
    zoom: z.number().positive().finite(),
    pan: z.tuple([z.number().finite(), z.number().finite()]),
  })
  .strict();
export type PrefabView = z.infer<typeof prefabViewSchema>;
export const DEFAULT_PREFAB_VIEW: PrefabView = {
  yaw: 0,
  pitch: 0,
  zoom: 1,
  pan: [0, 0],
};
const DEFAULT_CAMERA = {
  position: [4, 3, 4],
  target: [0, 0, 0],
  fov: 45,
} as const;

/** Pan moves the framing right/up in camera space; zoom divides orbit distance. */
export function resolvePrefabOrbitCamera(
  camera: PrefabPreviewDescriptor["camera"],
  value: PrefabView,
) {
  const view = prefabViewSchema.parse(value);
  const base = camera ?? DEFAULT_CAMERA;
  const [x, y, z] = base.position.map(
    (coordinate, index) => coordinate - base.target[index]!,
  );
  const radius = Math.hypot(x!, y!, z!);
  if (!radius)
    throw new Error("Prefab camera position must differ from its target.");
  const yaw = Math.atan2(x!, z!) + (view.yaw * Math.PI) / 180;
  const pitch = Math.max(
    (-89 * Math.PI) / 180,
    Math.min(
      (89 * Math.PI) / 180,
      Math.asin(y! / radius) + (view.pitch * Math.PI) / 180,
    ),
  );
  const distance = radius / view.zoom;
  const height = 2 * distance * Math.tan(((base.fov ?? 45) * Math.PI) / 360);
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up = [
    -Math.sin(pitch) * Math.sin(yaw),
    Math.cos(pitch),
    -Math.sin(pitch) * Math.cos(yaw),
  ];
  const target: [number, number, number] = [0, 1, 2].map(
    (index) =>
      base.target[index]! +
      height * (view.pan[0] * right[index]! + view.pan[1] * up[index]!),
  ) as [number, number, number];
  const position: [number, number, number] = [
    target[0] + distance * Math.cos(pitch) * Math.sin(yaw),
    target[1] + distance * Math.sin(pitch),
    target[2] + distance * Math.cos(pitch) * Math.cos(yaw),
  ];
  return { position, target, fov: base.fov ?? 45 };
}

/** Apply translate, then scale around the prefab's default framing centre. */
export function resolvePrefab2DTransform(
  value: PrefabView,
  viewHeight: number,
) {
  const view = prefabViewSchema.parse(value);
  if (!Number.isFinite(viewHeight) || viewHeight <= 0)
    throw new Error("View height must be positive.");
  return {
    scale: view.zoom,
    translate: [view.pan[0] * viewHeight, -view.pan[1] * viewHeight] as [
      number,
      number,
    ],
  };
}
