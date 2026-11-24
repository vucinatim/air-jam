import { describe, expect, it } from "vitest";
import {
  airJamArcadePlatformActions,
  arcadeBrowserConfirmPayloadSchema,
  arcadeBrowserNavigatePayloadSchema,
} from "../src/protocol/arcade-platform-actions";

describe("arcade platform action contract", () => {
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
