import { describe, expect, it } from "vitest";
import { resolveArcadePreviewControllerLauncherPresentation } from "./arcade-preview-controller-launcher";

const controller = (
  source: "phone" | "preview" | "virtual",
  connected = true,
) => ({
  controllerId: `${source}-controller`,
  source,
  connected,
  resumeLeaseExpiresAt: null,
});

describe("resolveArcadePreviewControllerLauncherPresentation", () => {
  it("offers a clear zero-setup trial in an empty Arcade browser", () => {
    expect(
      resolveArcadePreviewControllerLauncherPresentation({
        surfaceKind: "browser",
        controllers: [],
      }),
    ).toEqual({
      variant: "full",
      showWhenIdle: true,
      label: "Try controls",
    });
  });

  it.each(["phone", "virtual"] as const)(
    "collapses after a connected %s controller joins the browser",
    (source) => {
      expect(
        resolveArcadePreviewControllerLauncherPresentation({
          surfaceKind: "browser",
          controllers: [controller(source)],
        }),
      ).toEqual({
        variant: "compact",
        showWhenIdle: true,
        label: "On-screen controls",
      });
    },
  );

  it("does not treat a preview controller as an external phone", () => {
    expect(
      resolveArcadePreviewControllerLauncherPresentation({
        surfaceKind: "browser",
        controllers: [controller("preview")],
      }),
    ).toEqual({
      variant: "full",
      showWhenIdle: true,
      label: "Try controls",
    });
  });

  it("hides the idle floating launcher during phone-controlled gameplay", () => {
    expect(
      resolveArcadePreviewControllerLauncherPresentation({
        surfaceKind: "game",
        controllers: [controller("phone")],
      }),
    ).toEqual({
      variant: "compact",
      showWhenIdle: false,
      label: "On-screen controls",
    });
  });

  it("keeps compact on-screen control access when no external controller exists", () => {
    expect(
      resolveArcadePreviewControllerLauncherPresentation({
        surfaceKind: "game",
        controllers: [],
      }),
    ).toEqual({
      variant: "compact",
      showWhenIdle: true,
      label: "On-screen controls",
    });
  });
});
