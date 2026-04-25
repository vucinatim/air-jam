import { describe, expect, it } from "vitest";
import { controllerActionRpcSchema } from "../src/protocol";

describe("controller action RPC contract", () => {
  it("accepts omitted payloads and plain object payloads", () => {
    expect(
      controllerActionRpcSchema.safeParse({
        roomId: "ROOM1",
        actionName: "startMatch",
        payload: undefined,
        storeDomain: "game.match",
      }).success,
    ).toBe(true);

    expect(
      controllerActionRpcSchema.safeParse({
        roomId: "ROOM1",
        actionName: "joinTeam",
        payload: {
          team: "red",
          metadata: { ready: true },
          scores: [1, 2, 3],
        },
        storeDomain: "game.match",
      }).success,
    ).toBe(true);
  });

  it("rejects primitive, null, and array payloads", () => {
    for (const payload of ["red", 1, true, null, ["red"]]) {
      expect(
        controllerActionRpcSchema.safeParse({
          roomId: "ROOM1",
          actionName: "joinTeam",
          payload,
          storeDomain: "game.match",
        }).success,
      ).toBe(false);
    }
  });
});
