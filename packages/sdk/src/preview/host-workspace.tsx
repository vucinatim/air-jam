import { useAirJamHost } from "../hooks/use-air-jam-host";
import { usePlatformSettings } from "../settings/platform-settings-runtime";
import { cn } from "../utils/cn";
import {
  PreviewControllerWorkspace,
  type PreviewControllerWorkspaceProps,
} from "./workspace";

export type HostPreviewControllerWorkspaceProps = Omit<
  PreviewControllerWorkspaceProps,
  "joinUrl"
>;

export const HostPreviewControllerWorkspace = ({
  enabled = false,
  className,
  ...props
}: HostPreviewControllerWorkspaceProps) => {
  const host = useAirJamHost();
  const { updatePreviewControllers } = usePlatformSettings();
  const joinUrl =
    host.joinUrlStatus === "ready" && host.joinUrl ? host.joinUrl : null;

  return (
    <PreviewControllerWorkspace
      enabled={enabled}
      joinUrl={joinUrl}
      onActiveOpacityChange={(activeOpacity) =>
        updatePreviewControllers({ activeOpacity })
      }
      className={cn("top-4 right-4 z-60 sm:top-6 sm:right-6", className)}
      {...props}
    />
  );
};
