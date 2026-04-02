import { describe, expect, it } from "vitest";
import { AIR_CAPTURE_ARENA_PREFAB } from "../../../src/game/prefabs/arena";
import {
  AIR_CAPTURE_ARENA_DEFAULT_PROPS,
  resolveAirCaptureArenaProps,
} from "../../../src/game/prefabs/arena";

describe("air-capture arena prefab schema", () => {
  it("keeps a validated default arena contract", () => {
    expect(AIR_CAPTURE_ARENA_PREFAB.defaultProps).toEqual(
      AIR_CAPTURE_ARENA_DEFAULT_PROPS,
    );
  });

  it("merges nested directional light overrides safely", () => {
    expect(
      resolveAirCaptureArenaProps({
        directionalLightPosition: {
          x: 120,
        },
      }),
    ).toMatchObject({
      directionalLightPosition: {
        x: 120,
        y: AIR_CAPTURE_ARENA_DEFAULT_PROPS.directionalLightPosition.y,
        z: AIR_CAPTURE_ARENA_DEFAULT_PROPS.directionalLightPosition.z,
      },
    });
  });

  it("rejects invalid arena props", () => {
    expect(() =>
      resolveAirCaptureArenaProps({
        arenaRadius: -1,
      }),
    ).toThrow();
  });
});
