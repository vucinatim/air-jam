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
  const joinUrl = host.localControllerUrl || null;
  // A fresh room starts the game afresh too.
  const handleResetRoom = () => {
    void host.resetRoom().then(() => window.location.reload());
  };

  return (
    <PreviewControllerWorkspace
      enabled={resolvedEnabled}
      joinUrl={joinUrl}
      players={host.players}
      onRemoveController={host.removeController}
      onResetRoom={handleResetRoom}
      onActiveOpacityChange={(activeOpacity) =>
        platformSettingsOwner?.updatePreviewControllers({ activeOpacity })
      }
      className={cn("right-4 bottom-4 z-60 sm:right-6 sm:bottom-6", className)}
      {...props}
    />
  );
};
