import { definePrefab } from "@air-jam/sdk/prefabs";
import { JUMP_PAD_RADIUS } from "../../constants";
import { AIR_CAPTURE_JUMP_PAD_PREVIEW } from "./preview";
import { AirCaptureJumpPad } from "./render";
import {
  AIR_CAPTURE_JUMP_PAD_DEFAULT_PROPS,
  airCaptureJumpPadPrefabSchema,
} from "./schema";

export const AIR_CAPTURE_JUMP_PAD_PREFAB = definePrefab({
  id: "air-capture.jump-pad.standard",
  label: "Jump Pad",
  category: "mobility",
  description: "Standard launch pad used across the Air Capture arena.",
  tags: ["air-capture", "jump-pad", "3d", "mobility"],
  defaultProps: AIR_CAPTURE_JUMP_PAD_DEFAULT_PROPS,
  configSchema: airCaptureJumpPadPrefabSchema,
  preview: AIR_CAPTURE_JUMP_PAD_PREVIEW,
  render: AirCaptureJumpPad,
  placement: {
    origin: "ground",
    bounds: {
      radius: JUMP_PAD_RADIUS,
      height: 8,
    },
    footprint: {
      kind: "circle",
      radius: JUMP_PAD_RADIUS,
    },
  },
});
