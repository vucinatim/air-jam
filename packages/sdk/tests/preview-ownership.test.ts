import { describe, expect, it } from "vitest";
import {
  isEmbeddedArcadeRuntimeSearchParams,
  resolveHostPreviewControllerWorkspaceEnabled,
} from "../src/preview";

describe("host preview controller ownership", () => {
  it("enables standalone development host previews by default", () => {
    expect(
      resolveHostPreviewControllerWorkspaceEnabled({
        isDevelopmentRuntime: true,
        searchParams: "",
      }),
    ).toBe(true);
  });

  it("disables game-owned previews inside embedded Arcade runtimes", () => {
    expect(
      resolveHostPreviewControllerWorkspaceEnabled({
        isDevelopmentRuntime: true,
        searchParams:
          "aj_arcade_epoch=2&aj_arcade_kind=game&aj_arcade_game_id=pong",
      }),
    ).toBe(false);
  });

  it("disables automatic previews outside development", () => {
    expect(
      resolveHostPreviewControllerWorkspaceEnabled({
        isDevelopmentRuntime: false,
        searchParams: "",
      }),
    ).toBe(false);
  });

  it("keeps explicit enabled overrides authoritative", () => {
    const embeddedSearchParams =
      "aj_arcade_epoch=2&aj_arcade_kind=game&aj_arcade_game_id=pong";

    expect(
      resolveHostPreviewControllerWorkspaceEnabled({
        enabled: true,
        isDevelopmentRuntime: false,
        searchParams: embeddedSearchParams,
      }),
    ).toBe(true);
    expect(
      resolveHostPreviewControllerWorkspaceEnabled({
        enabled: false,
        isDevelopmentRuntime: true,
        searchParams: "",
      }),
    ).toBe(false);
  });

  it("detects embedded Arcade surface search params", () => {
    expect(
      isEmbeddedArcadeRuntimeSearchParams(
        "aj_arcade_epoch=1&aj_arcade_kind=browser",
      ),
    ).toBe(true);
    expect(isEmbeddedArcadeRuntimeSearchParams("aj_room=ROOM1")).toBe(false);
  });
});
