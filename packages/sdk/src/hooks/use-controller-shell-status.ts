import type { ConnectionStatus } from "../protocol";

export interface UseControllerShellStatusOptions {
  roomId: string | null;
  connectionStatus: ConnectionStatus;
  playerLabel?: string | null;
  fallbackLabel?: string;
  roomFallback?: string;
}

export interface ControllerShellStatus {
  connectionStatus: ConnectionStatus;
  displayName: string;
  roomDisplay: string;
  roomLine: string;
  hasIdentity: boolean;
  identityInitial: string;
}

export const useControllerShellStatus = ({
  roomId,
  connectionStatus,
  playerLabel,
  fallbackLabel = "Controller",
  roomFallback = "----",
}: UseControllerShellStatusOptions): ControllerShellStatus => {
  const trimmedLabel = playerLabel?.trim() ?? "";
  const displayName = trimmedLabel || fallbackLabel;
  const roomDisplay = roomId ?? roomFallback;
  const identityInitial = displayName.charAt(0).toUpperCase() || "M";

  return {
    connectionStatus,
    displayName,
    roomDisplay,
    roomLine: `Room ${roomDisplay}`,
    hasIdentity: trimmedLabel.length > 0,
    identityInitial,
  };
};
