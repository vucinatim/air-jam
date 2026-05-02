export type SignalType = "HAPTIC" | "TOAST";

export interface HapticSignalPayload {
  pattern: "light" | "medium" | "heavy" | "success" | "failure" | "custom";
  sequence?: number | number[];
}

export interface ToastSignalPayload {
  message: string;
  color?: string;
  duration?: number;
}

export type SignalPayload =
  | {
      targetId?: string;
      type: "HAPTIC";
      payload: HapticSignalPayload;
    }
  | {
      targetId?: string;
      type: "TOAST";
      payload: ToastSignalPayload;
    };

export interface PlaySoundEventPayload {
  roomId: string;
  targetControllerId?: string;
  soundId: string;
  volume?: number;
  loop?: boolean;
}

export interface PlaySoundPayload {
  id: string;
  volume?: number;
  loop?: boolean;
}
