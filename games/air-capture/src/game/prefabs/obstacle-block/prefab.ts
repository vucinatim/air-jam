import { definePrefab } from "@air-jam/sdk/prefabs";
import { AIR_CAPTURE_OBSTACLE_BLOCK_PREVIEW } from "./preview";
import {
  AIR_CAPTURE_OBSTACLE_BLOCK_DEFAULT_PROPS,
  airCaptureObstacleBlockPrefabSchema,
} from "./schema";

export const AIR_CAPTURE_OBSTACLE_BLOCK_PREFAB = definePrefab({
  space: "3d",
  id: "air-capture.obstacle.block",
  label: "Obstacle Block",
  category: "obstacle",
  description: "Standard cubic arena obstacle used for cover and path shaping.",
  tags: ["air-capture", "obstacle", "3d", "cover"],
  defaultProps: AIR_CAPTURE_OBSTACLE_BLOCK_DEFAULT_PROPS,
  configSchema: airCaptureObstacleBlockPrefabSchema,
  preview: AIR_CAPTURE_OBSTACLE_BLOCK_PREVIEW,
  placement: {
    origin: "ground",
    bounds: {
      width: AIR_CAPTURE_OBSTACLE_BLOCK_DEFAULT_PROPS.size[0],
      height: AIR_CAPTURE_OBSTACLE_BLOCK_DEFAULT_PROPS.size[1],
      depth: AIR_CAPTURE_OBSTACLE_BLOCK_DEFAULT_PROPS.size[2],
    },
    footprint: {
      kind: "box",
      width: AIR_CAPTURE_OBSTACLE_BLOCK_DEFAULT_PROPS.size[0],
      depth: AIR_CAPTURE_OBSTACLE_BLOCK_DEFAULT_PROPS.size[2],
    },
  },
});
