import { useAirJamConfig } from "../context/air-jam-context";
import { useAirJamHost } from "../hooks/use-air-jam-host";
import { useOptionalPlatformSettingsOwnerApi } from "../settings/platform-settings-runtime";
import { cn } from "../utils/cn";
import {
  resolveHostPreviewControllerWorkspaceEnabled,
  type HostPreviewControllerWorkspaceEnabled,
} from "./ownership";
import {
  PreviewControllerWorkspace,
  type PreviewControllerWorkspaceProps,
} from "./workspace";

export type HostPreviewControllerWorkspaceProps = Omit<
  PreviewControllerWorkspaceProps,
  "enabled" | "joinUrl"
> & {
  enabled?: HostPreviewControllerWorkspaceEnabled;
};

export const HostPreviewControllerWorkspace = ({
  enabled = "auto",
  className,
  ...props
}: HostPreviewControllerWorkspaceProps) => {
  const host = useAirJamHost();
  const config = useAirJamConfig();
  const platformSettingsOwner = useOptionalPlatformSettingsOwnerApi();
  const resolvedEnabled = resolveHostPreviewControllerWorkspaceEnabled({
    enabled,
    topology: config.topology,
  });
  const joinUrl =
    host.joinUrlStatus === "ready" && host.joinUrl ? host.joinUrl : null;
  const handleResetRoom = async () => {
    const ack = await host.resetRoom();
    if (!ack.ok || typeof window === "undefined") {
      return ack;
    }

    window.location.reload();
    return ack;
  };

  return (
    <PreviewControllerWorkspace
      enabled={resolvedEnabled}
      joinUrl={joinUrl}
      controllers={host.controllers}
      onRemoveController={host.removeController}
      onResetRoom={handleResetRoom}
      onActiveOpacityChange={(activeOpacity) =>
        platformSettingsOwner?.updatePreviewControllers({ activeOpacity })
      }
      className={cn("top-4 right-4 z-60 sm:top-6 sm:right-6", className)}
      {...props}
    />
  );
};
