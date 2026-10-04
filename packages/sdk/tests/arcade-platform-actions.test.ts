import { describe, expect, it } from "vitest";
import {
  AIRJAM_ARCADE_PLATFORM_ACTION_PREFIX,
  airJamArcadePlatformActions,
  arcadeBrowserConfirmPayloadSchema,
  arcadeBrowserNavigatePayloadSchema,
  isAirJamArcadePlatformPrefixAction,
} from "../src/protocol/arcade-platform-actions";

describe("arcade platform action contract", () => {
  it("uses a single documented prefix for master routing", () => {
    expect(AIRJAM_ARCADE_PLATFORM_ACTION_PREFIX).toBe("airjam.arcade.");
    for (const name of Object.values(airJamArcadePlatformActions)) {
      expect(isAirJamArcadePlatformPrefixAction(name)).toBe(true);
    }
  });

  it("does not treat gameplay-like names as platform prefix", () => {
    expect(isAirJamArcadePlatformPrefixAction("joinTeam")).toBe(false);
    expect(isAirJamArcadePlatformPrefixAction("airjam.game.foo")).toBe(false);
  });

  it("defines semantic menu commands with a strict surface epoch", () => {
    expect(airJamArcadePlatformActions.navigate).toBe("airjam.arcade.navigate");
    expect(airJamArcadePlatformActions.confirm).toBe("airjam.arcade.confirm");
    expect(arcadeBrowserConfirmPayloadSchema.parse({ epoch: 1 })).toEqual({
      epoch: 1,
    });
    for (const direction of ["up", "down", "left", "right"]) {
      expect(
        arcadeBrowserNavigatePayloadSchema.parse({ epoch: 3, direction }),
      ).toEqual({ epoch: 3, direction });
    }
  });

  it.each([
    undefined,
    {},
    { epoch: 0 },
    { epoch: -1 },
    { epoch: 1.5 },
    { epoch: Infinity },
    { epoch: Number.MAX_SAFE_INTEGER + 1 },
    { epoch: "1" },
    { epoch: 1, action: true },
  ])("rejects malformed confirm payload %j", (payload) => {
    expect(arcadeBrowserConfirmPayloadSchema.safeParse(payload).success).toBe(
      false,
    );
  });

  it.each([
    { epoch: 1 },
    { epoch: 1, direction: "diagonal" },
    { epoch: 1, direction: "up", vector: { x: 0, y: -1 } },
  ])("rejects malformed navigation payload %j", (payload) => {
    expect(arcadeBrowserNavigatePayloadSchema.safeParse(payload).success).toBe(
      false,
    );
  });
});
