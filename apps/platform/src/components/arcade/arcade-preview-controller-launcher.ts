import type { ControllerPresenceNotice } from "@air-jam/sdk/protocol";

export type ArcadePreviewControllerLauncherVariant = "full" | "compact";

export interface ArcadePreviewControllerLauncherPresentation {
  variant: ArcadePreviewControllerLauncherVariant;
  showWhenIdle: boolean;
  label: string;
}

export const resolveArcadePreviewControllerLauncherPresentation = ({
  surfaceKind,
  controllers,
}: {
  surfaceKind: "browser" | "game";
  controllers: readonly ControllerPresenceNotice[];
}): ArcadePreviewControllerLauncherPresentation => {
  const hasConnectedExternalController = controllers.some(
    (controller) =>
      controller.connected &&
      (controller.source === "phone" || controller.source === "virtual"),
  );

  if (surfaceKind === "browser" && !hasConnectedExternalController) {
    return {
      variant: "full",
      showWhenIdle: true,
      label: "Try controls",
    };
  }

  if (surfaceKind === "game" && hasConnectedExternalController) {
    return {
      variant: "compact",
      showWhenIdle: false,
      label: "On-screen controls",
    };
  }

  return {
    variant: "compact",
    showWhenIdle: true,
    label: "On-screen controls",
  };
};
