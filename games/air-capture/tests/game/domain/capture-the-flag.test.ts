import { describe, expect, it } from "vitest";
import {
  createInitialFlags,
  createInitialScores,
  generateRandomBasePositions,
  getEnemyTeam,
} from "../../../src/game/domain/capture-the-flag";

describe("air-capture capture-the-flag domain", () => {
  it("builds initial flag positions from bases", () => {
    const flags = createInitialFlags({
      solaris: [1, 0, 2],
      nebulon: [-1, 0, -2],
    });

    expect(flags.solaris).toMatchObject({
      teamId: "solaris",
      status: "atBase",
      position: [1, 0, 2],
    });
    expect(flags.nebulon.position).toEqual([-1, 0, -2]);
  });

  it("creates zeroed team scores", () => {
    expect(createInitialScores()).toEqual({
      solaris: 0,
      nebulon: 0,
    });
  });

  it("returns the opposite team deterministically", () => {
    expect(getEnemyTeam("solaris")).toBe("nebulon");
    expect(getEnemyTeam("nebulon")).toBe("solaris");
  });

  it("keeps generated bases inside the arena safety bounds", () => {
    const sequence = [0.1, 0.5, 0.3, 0.9, 0.8];
    let index = 0;
    const positions = generateRandomBasePositions(
      () => sequence[index++] ?? 0.5,
    );

    for (const position of Object.values(positions)) {
      const radius = Math.sqrt(position[0] ** 2 + position[2] ** 2);
      expect(radius).toBeLessThanOrEqual(200);
    }
  });
});
