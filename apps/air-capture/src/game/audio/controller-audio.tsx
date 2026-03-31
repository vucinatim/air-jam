import {
  ControllerRemoteAudioRuntime,
  PlatformSettingsRuntime,
} from "@air-jam/sdk";
import type { ReactNode } from "react";
import {
  CONTROLLER_SOUND_MANIFEST,
} from "./sounds";

export function ControllerAudioProvider({
  children,
  remoteEnabled,
}: {
  children: ReactNode;
  remoteEnabled: boolean;
}) {
  return (
    <PlatformSettingsRuntime>
      <ControllerRemoteAudioRuntime
        manifest={CONTROLLER_SOUND_MANIFEST}
        enabled={remoteEnabled}
      >
        {children}
      </ControllerRemoteAudioRuntime>
    </PlatformSettingsRuntime>
  );
}
