import { useAirJamHost } from "../hooks/use-air-jam-host";
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
  ...props
}: HostPreviewControllerWorkspaceProps) => {
  const host = useAirJamHost();
  const joinUrl =
    host.joinUrlStatus === "ready" && host.joinUrl ? host.joinUrl : null;

  return (
    <PreviewControllerWorkspace enabled={enabled} joinUrl={joinUrl} {...props} />
  );
};
