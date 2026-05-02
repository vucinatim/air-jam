import { describe, expect, it } from "vitest";
import {
  getShipAbilityFeedback,
  shouldActivateShipAbility,
  stepShipAbility,
} from "../../../../src/game/engine/ships/abilities";

describe("air-capture ship ability engine", () => {
  it("only activates queued abilities", () => {
    expect(
      shouldActivateShipAbility({
        abilityPressed: true,
        wasAbilityPressed: false,
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
        wasAbilityPressed: false,
        currentAbility: {
          id: "speed_boost",
          name: "Speed Boost",
          icon: "x",
          duration: 5,
          startTime: Date.now(),
        },
      }),
    ).toBe(false);

    expect(
      shouldActivateShipAbility({
        abilityPressed: true,
        wasAbilityPressed: true,
        currentAbility: {
          id: "speed_boost",
          name: "Speed Boost",
          icon: "x",
          duration: 5,
          startTime: null,
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

  it("uses a second ability press to detonate an active rocket", () => {
    let detonatedRocketId: string | null = null;

    stepShipAbility({
      controllerId: "pilot-1",
      abilityPressed: true,
      wasAbilityPressed: false,
      currentAbility: null,
      delta: 1 / 60,
      activateAbility: () => {},
      getActiveRocketId: () => "rocket-7",
      requestDetonateRocket: (id) => {
        detonatedRocketId = id;
      },
      updateActiveAbilities: () => {},
      playSound: () => {},
      sendHaptic: () => {},
    });

    expect(detonatedRocketId).toBe("rocket-7");
  });
});
