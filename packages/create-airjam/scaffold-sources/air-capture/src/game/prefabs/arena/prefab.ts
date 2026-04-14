import { definePrefab } from "@air-jam/sdk/prefabs";
import { paintAirCaptureArena } from "./paint-arena";
import { AIR_CAPTURE_ARENA_PREVIEW } from "./preview";
import {
  AIR_CAPTURE_ARENA_DEFAULT_PROPS,
  airCaptureArenaPrefabSchema,
} from "./schema";

export const AIR_CAPTURE_ARENA_PREFAB = definePrefab({
  id: "air-capture.arena.default",
  label: "Air Capture Arena",
  category: "arena",
  description:
    "Default Air Capture arena composition with space environment, obstacles, bases, flags, and jump pads.",
  tags: ["air-capture", "arena", "3d", "reference"],
  defaultProps: AIR_CAPTURE_ARENA_DEFAULT_PROPS,
  configSchema: airCaptureArenaPrefabSchema,
  preview: AIR_CAPTURE_ARENA_PREVIEW,
  render: paintAirCaptureArena,
  placement: {
    origin: "center",
    bounds: {
      radius: AIR_CAPTURE_ARENA_DEFAULT_PROPS.arenaRadius,
    },
    footprint: {
      kind: "circle",
      radius: AIR_CAPTURE_ARENA_DEFAULT_PROPS.arenaRadius,
    },
  },
});
