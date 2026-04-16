import { describe, expect, it } from "vitest";
import {
  AIR_CAPTURE_PREFABS,
  AIR_CAPTURE_ARENA_PREFAB,
  AIR_CAPTURE_FLAG_PREFAB,
  AIR_CAPTURE_JUMP_PAD_PREFAB,
  AIR_CAPTURE_OBSTACLE_BLOCK_PREFAB,
  AIR_CAPTURE_PLAYER_BASE_PREFAB,
  AIR_CAPTURE_SHIP_PREFAB,
} from "../../../src/game/prefabs";
import {
  AIR_CAPTURE_ARENA_DEFAULT_PROPS,
  resolveAirCaptureArenaProps,
} from "../../../src/game/prefabs/arena";

describe("air-capture arena prefab schema", () => {
  it("keeps a validated default arena contract", () => {
    expect(AIR_CAPTURE_ARENA_PREFAB.defaultProps).toEqual(
      AIR_CAPTURE_ARENA_DEFAULT_PROPS,
    );
    expect(AIR_CAPTURE_ARENA_PREFAB.placement?.origin).toBe("center");
  });

  it("exports the current canonical prefab set through the game-owned prefab catalog", () => {
    expect(AIR_CAPTURE_PREFABS).toEqual(
      expect.arrayContaining([
        AIR_CAPTURE_ARENA_PREFAB,
        AIR_CAPTURE_FLAG_PREFAB,
        AIR_CAPTURE_JUMP_PAD_PREFAB,
        AIR_CAPTURE_OBSTACLE_BLOCK_PREFAB,
        AIR_CAPTURE_PLAYER_BASE_PREFAB,
        AIR_CAPTURE_SHIP_PREFAB,
      ]),
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
