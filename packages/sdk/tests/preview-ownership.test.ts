import { describe, expect, it } from "vitest";
import {
  isEmbeddedArcadeRuntimeSearchParams,
  resolveHostPreviewControllerWorkspaceEnabled,
} from "../src/preview/ownership";

describe("host preview controller ownership", () => {
  it("enables standalone development host previews by default", () => {
    expect(
      resolveHostPreviewControllerWorkspaceEnabled({
        topology: {
          runtimeMode: "standalone-dev",
        },
        searchParams: "",
      }),
    ).toBe(true);
  });

  it("disables game-owned previews inside embedded Arcade runtimes", () => {
    expect(
      resolveHostPreviewControllerWorkspaceEnabled({
        topology: {
          runtimeMode: "arcade-live",
        },
        searchParams:
          "aj_arcade_epoch=2&aj_arcade_kind=game&aj_arcade_game_id=pong",
      }),
    ).toBe(false);
  });

  it("disables automatic previews outside development", () => {
    expect(
      resolveHostPreviewControllerWorkspaceEnabled({
        topology: {
          runtimeMode: "hosted-release",
        },
        searchParams: "",
      }),
    ).toBe(false);
  });

  it("leaves controller placement to an embedded workspace", () => {
    expect(
      resolveHostPreviewControllerWorkspaceEnabled({
        topology: { runtimeMode: "standalone-dev", embedded: true },
        isEmbeddedRuntime: false,
      }),
    ).toBe(false);
    expect(
      resolveHostPreviewControllerWorkspaceEnabled({
        topology: { runtimeMode: "standalone-dev" },
        isEmbeddedRuntime: true,
      }),
    ).toBe(false);
    expect(
      resolveHostPreviewControllerWorkspaceEnabled({
        enabled: true,
        topology: { runtimeMode: "standalone-dev", embedded: true },
        isEmbeddedRuntime: true,
      }),
    ).toBe(true);
  });

  it("keeps explicit enabled overrides authoritative", () => {
    const embeddedSearchParams =
      "aj_arcade_epoch=2&aj_arcade_kind=game&aj_arcade_game_id=pong";

    expect(
      resolveHostPreviewControllerWorkspaceEnabled({
        enabled: true,
        topology: {
          runtimeMode: "hosted-release",
        },
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
