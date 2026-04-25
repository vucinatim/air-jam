import { definePrefabCaptureHarness } from "@air-jam/harness";
import { AIR_CAPTURE_PREFABS } from "../src/game/prefabs";
import {
  AIR_CAPTURE_PREFAB_CAPTURE_STAGE_TEST_ID,
  buildAirCapturePrefabCaptureUrl,
} from "../src/prefab-preview/params";

const findPrefab = (prefabId: string) => {
  const prefab = AIR_CAPTURE_PREFABS.find(
    (candidate) => candidate.id === prefabId,
  );
  if (!prefab) {
    throw new Error(`Unknown Air Capture prefab "${prefabId}".`);
  }
  return prefab;
};

export const prefabCaptureHarness = definePrefabCaptureHarness({
  gameId: "air-capture",
  prefabs: [
    {
      id: "arena",
      prefabId: findPrefab("air-capture.arena.default").id,
      description: "Default arena composition capture.",
      viewport: {
        width: 1440,
        height: 1024,
      },
      waitForTestId: AIR_CAPTURE_PREFAB_CAPTURE_STAGE_TEST_ID,
      buildHostUrl: (hostUrl, request) =>
        buildAirCapturePrefabCaptureUrl({
          hostUrl,
          prefabId: request.prefabId,
          variants: request.variants,
        }),
    },
    {
      id: "flag",
      prefabId: findPrefab("air-capture.flag.team").id,
      description: "Team flag unit capture.",
      viewport: {
        width: 1024,
        height: 1024,
      },
      waitForTestId: AIR_CAPTURE_PREFAB_CAPTURE_STAGE_TEST_ID,
      buildHostUrl: (hostUrl, request) =>
        buildAirCapturePrefabCaptureUrl({
          hostUrl,
          prefabId: request.prefabId,
          variants: request.variants,
        }),
    },
    {
      id: "jump-pad",
      prefabId: findPrefab("air-capture.jump-pad.standard").id,
      description: "Jump pad unit capture.",
      viewport: {
        width: 1024,
        height: 1024,
      },
      waitForTestId: AIR_CAPTURE_PREFAB_CAPTURE_STAGE_TEST_ID,
      buildHostUrl: (hostUrl, request) =>
        buildAirCapturePrefabCaptureUrl({
          hostUrl,
          prefabId: request.prefabId,
          variants: request.variants,
        }),
    },
    {
      id: "obstacle-block",
      prefabId: findPrefab("air-capture.obstacle.block").id,
      description: "Obstacle block unit capture.",
      viewport: {
        width: 1024,
        height: 1024,
      },
      waitForTestId: AIR_CAPTURE_PREFAB_CAPTURE_STAGE_TEST_ID,
      buildHostUrl: (hostUrl, request) =>
        buildAirCapturePrefabCaptureUrl({
          hostUrl,
          prefabId: request.prefabId,
          variants: request.variants,
        }),
    },
    {
      id: "player-base",
      prefabId: findPrefab("air-capture.player-base.team").id,
      description: "Player base unit capture.",
      viewport: {
        width: 1024,
        height: 1024,
      },
      waitForTestId: AIR_CAPTURE_PREFAB_CAPTURE_STAGE_TEST_ID,
      buildHostUrl: (hostUrl, request) =>
        buildAirCapturePrefabCaptureUrl({
          hostUrl,
          prefabId: request.prefabId,
          variants: request.variants,
        }),
    },
    {
      id: "ship",
      prefabId: findPrefab("air-capture.ship.standard").id,
      description: "Playable ship unit capture.",
      viewport: {
        width: 1024,
        height: 1024,
      },
      waitForTestId: AIR_CAPTURE_PREFAB_CAPTURE_STAGE_TEST_ID,
      buildHostUrl: (hostUrl, request) =>
        buildAirCapturePrefabCaptureUrl({
          hostUrl,
          prefabId: request.prefabId,
          variants: request.variants,
        }),
    },
  ] as const,
});
