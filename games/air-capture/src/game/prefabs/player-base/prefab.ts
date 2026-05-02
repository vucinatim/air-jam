import { definePrefab } from "@air-jam/sdk/prefabs";
import { AIR_CAPTURE_PLAYER_BASE_PREVIEW } from "./preview";
import { AirCapturePlayerBase } from "./render";
import {
  AIR_CAPTURE_PLAYER_BASE_DEFAULT_PROPS,
  airCapturePlayerBasePrefabSchema,
} from "./schema";

export const AIR_CAPTURE_PLAYER_BASE_PREFAB = definePrefab({
  id: "air-capture.player-base.team",
  label: "Player Base",
  category: "objective",
  description: "Team base zone used for scoring and flag return behavior.",
  tags: ["air-capture", "base", "objective", "3d"],
  defaultProps: AIR_CAPTURE_PLAYER_BASE_DEFAULT_PROPS,
  configSchema: airCapturePlayerBasePrefabSchema,
  preview: AIR_CAPTURE_PLAYER_BASE_PREVIEW,
  render: AirCapturePlayerBase,
  placement: {
    origin: "ground",
    bounds: {
      radius: 10,
      height: 10,
    },
    footprint: {
      kind: "circle",
      radius: 10,
    },
  },
});
