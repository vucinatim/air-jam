import { definePrefab } from "@air-jam/sdk/prefabs";
import { AIR_CAPTURE_SHIP_PREVIEW } from "./preview";
import { AirCaptureShip } from "./render";
import {
  AIR_CAPTURE_SHIP_DEFAULT_PROPS,
  airCaptureShipPrefabSchema,
} from "./schema";

export const AIR_CAPTURE_SHIP_PREFAB = definePrefab({
  id: "air-capture.ship.standard",
  label: "Ship",
  category: "actor",
  description: "Standard playable ship used by both controllers and bots.",
  tags: ["air-capture", "ship", "player", "3d"],
  defaultProps: AIR_CAPTURE_SHIP_DEFAULT_PROPS,
  configSchema: airCaptureShipPrefabSchema,
  preview: AIR_CAPTURE_SHIP_PREVIEW,
  render: AirCaptureShip,
  placement: {
    origin: "center",
    bounds: {
      width: 4,
      height: 10,
      depth: 8,
    },
    footprint: {
      kind: "circle",
      radius: 4,
    },
  },
});
