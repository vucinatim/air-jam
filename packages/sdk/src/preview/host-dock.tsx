import { useAirJamHost } from "../hooks/use-air-jam-host";
import {
  PreviewControllerDock,
  type PreviewControllerDockProps,
} from "./dock";

export type HostPreviewControllerDockProps = Omit<
  PreviewControllerDockProps,
  "joinUrl"
>;

export const HostPreviewControllerDock = ({
  enabled = false,
  ...props
}: HostPreviewControllerDockProps) => {
  const host = useAirJamHost();
  const joinUrl =
    host.joinUrlStatus === "ready" && host.joinUrl ? host.joinUrl : null;

  return <PreviewControllerDock enabled={enabled} joinUrl={joinUrl} {...props} />;
};
