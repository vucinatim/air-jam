import { describe, expect, it } from "vitest";
import {
  getShipAbilityFeedback,
  shouldActivateShipAbility,
} from "../../../../src/game/engine/ships/abilities";

describe("air-capture ship ability engine", () => {
  it("only activates queued abilities", () => {
    expect(
      shouldActivateShipAbility({
        abilityPressed: true,
        currentAbility: {
          id: "speed_boost",
          name: "Speed Boost",
          icon: "x",
          duration: 5,
          startTime: null,
        },
      }),
    ).toBe(true);

    expect(
      shouldActivateShipAbility({
        abilityPressed: true,
        currentAbility: {
          id: "speed_boost",
          name: "Speed Boost",
          icon: "x",
          duration: 5,
          startTime: Date.now(),
        },
      }),
    ).toBe(false);
  });

  it("maps ability ids to host feedback consistently", () => {
    expect(getShipAbilityFeedback("speed_boost")).toEqual({
      sound: "speed_boost",
      haptic: "medium",
    });
    expect(getShipAbilityFeedback("rocket")).toEqual({
      sound: "rocket_launch",
      haptic: "heavy",
    });
  });
});
