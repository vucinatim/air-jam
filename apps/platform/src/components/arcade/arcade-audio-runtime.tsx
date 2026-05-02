"use client";

import { AudioRuntime, type SoundManifest } from "@air-jam/sdk";
import type { ReactNode } from "react";

const ARCADE_AUDIO_MANIFEST = {
  ping: {
    src: ["/audio/ping.mp3"],
    volume: 1,
    category: "sfx",
  },
} as const satisfies SoundManifest;

export type ArcadeAudioId = keyof typeof ARCADE_AUDIO_MANIFEST;

export function ArcadeAudioRuntime({ children }: { children: ReactNode }) {
  return (
    <AudioRuntime manifest={ARCADE_AUDIO_MANIFEST}>{children}</AudioRuntime>
  );
}
