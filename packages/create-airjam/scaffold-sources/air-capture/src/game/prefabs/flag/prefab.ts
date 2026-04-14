import { definePrefab } from "@air-jam/sdk/prefabs";
import { AIR_CAPTURE_FLAG_PREVIEW } from "./preview";
import { AirCaptureFlag } from "./render";
import {
  AIR_CAPTURE_FLAG_DEFAULT_PROPS,
  airCaptureFlagPrefabSchema,
} from "./schema";

export const AIR_CAPTURE_FLAG_PREFAB = definePrefab({
  id: "air-capture.flag.team",
  label: "Team Flag",
  category: "objective",
  description: "Team flag objective that can be captured, dropped, and returned.",
  tags: ["air-capture", "flag", "objective", "3d"],
  defaultProps: AIR_CAPTURE_FLAG_DEFAULT_PROPS,
  configSchema: airCaptureFlagPrefabSchema,
  preview: AIR_CAPTURE_FLAG_PREVIEW,
  render: AirCaptureFlag,
  placement: {
    origin: "ground",
    bounds: {
      radius: 4.5,
      height: 6,
    },
    footprint: {
      kind: "circle",
      radius: 4.5,
    },
  },
});
