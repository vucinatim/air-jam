import { describe, expect, it } from "vitest";
import { definePrefabCaptureHarness } from "../src/visual/prefab-contract";

describe("definePrefabCaptureHarness", () => {
  it("preserves a game-owned prefab capture contract", () => {
    const harness = definePrefabCaptureHarness({
      gameId: "air-capture",
      prefabs: [
        {
          id: "flag",
          prefabId: "air-capture.flag.team",
          viewport: {
            width: 1024,
            height: 1024,
          },
          waitForTestId: "stage",
          buildHostUrl: (hostUrl, request) => {
            const url = new URL(hostUrl);
            url.searchParams.set("surface", "prefab");
            url.searchParams.set("prefab", request.prefabId);
            return url.toString();
          },
        },
      ],
    });

    expect(harness.gameId).toBe("air-capture");
    expect(harness.prefabs[0]?.prefabId).toBe("air-capture.flag.team");
    expect(harness.prefabs[0]?.viewport).toEqual({
      width: 1024,
      height: 1024,
    });
  });
});
