import type { IconProps } from "@tabler/icons-react";
import {
  IconArrowLeft,
  IconCheck,
  IconDeviceGamepad2,
  IconMenu2,
  IconPlayerPause,
  IconPlayerPlay,
  IconQrcode,
  IconSettings,
  IconWifi,
  IconWifiOff,
  IconX,
} from "@tabler/icons-react";

export type SystemIconProps = IconProps;

// Keep general UI/system icons behind local wrappers so the project can
// curate or swap the vendor package later without changing call sites.
export const BackIcon = IconArrowLeft;
export const ConfirmIcon = IconCheck;
export const ControllerIcon = IconDeviceGamepad2;
export const MenuIcon = IconMenu2;
export const PauseIcon = IconPlayerPause;
export const PlayIcon = IconPlayerPlay;
export const QrCodeIcon = IconQrcode;
export const SettingsIcon = IconSettings;
export const ConnectedIcon = IconWifi;
export const DisconnectedIcon = IconWifiOff;
export const CloseIcon = IconX;
