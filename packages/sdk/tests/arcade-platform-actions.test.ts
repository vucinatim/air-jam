import { describe, expect, it } from "vitest";
import {
  AIRJAM_ARCADE_PLATFORM_ACTION_PREFIX,
  airJamArcadePlatformActions,
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
});
