import type { ConnectionStatus } from "@air-jam/sdk";

export const useControllerConnectionNotice = (connectionStatus: ConnectionStatus) => {
  const canSendSystemCommand = connectionStatus === "connected";
  const controlsDisabled = !canSendSystemCommand;
  const isConnecting =
    connectionStatus === "connecting" || connectionStatus === "reconnecting";
  const connectionNotice = controlsDisabled
    ? isConnecting
      ? "Reconnecting. Controls are temporarily disabled."
      : "Disconnected. Rejoin the room to continue."
    : null;

  return {
    canSendSystemCommand,
    controlsDisabled,
    connectionNotice,
  };
};
