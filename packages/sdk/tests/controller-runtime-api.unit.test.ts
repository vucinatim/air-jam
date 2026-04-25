import { describe, expect, it } from "vitest";
import { resolveControllerJoinSource } from "../src/hooks/internal/use-controller-runtime-api";

describe("resolveControllerJoinSource", () => {
  it("prefers embedded room ids over other sources", () => {
    expect(
      resolveControllerJoinSource({
        embeddedRoomId: "ROOM1",
        optionRoomId: "ROOM2",
        urlRoomId: "ROOM3",
      }),
    ).toBe("embedded");
  });

  it("falls back to explicit options before URL room codes", () => {
    expect(
      resolveControllerJoinSource({
        optionRoomId: "ROOM2",
        urlRoomId: "ROOM3",
      }),
    ).toBe("options");
  });

  it("uses URL room codes when no stronger source exists", () => {
    expect(
      resolveControllerJoinSource({
        urlRoomId: "ROOM3",
      }),
    ).toBe("url");
  });

  it("returns unknown when no room source is available", () => {
    expect(resolveControllerJoinSource({})).toBe("unknown");
  });
});
