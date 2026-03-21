import { describe, expect, it } from "vitest";
import { isInternalActionName } from "../src/store/create-air-jam-store";

describe("isInternalActionName", () => {
  it("returns true for underscore-prefixed names", () => {
    expect(isInternalActionName("_syncState")).toBe(true);
    expect(isInternalActionName("_internal")).toBe(true);
  });

  it("returns false for public action names", () => {
    expect(isInternalActionName("joinTeam")).toBe(false);
    expect(isInternalActionName("scorePoint")).toBe(false);
  });
});
