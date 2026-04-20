import { AudioRuntime } from "@air-jam/sdk";
import type { ReactNode } from "react";
import { CONTROLLER_SOUND_MANIFEST } from "./sounds";

export function ControllerAudioProvider({ children }: { children: ReactNode }) {
  return (
    <AudioRuntime manifest={CONTROLLER_SOUND_MANIFEST}>{children}</AudioRuntime>
  );
}
