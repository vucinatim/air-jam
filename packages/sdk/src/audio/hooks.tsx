/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef } from "react";
import { AudioManager, SoundManifest } from "./audio-manager";

import { getSocketClient } from "../socket-client";
import { useConnectionStore } from "../state/connection-store";

// Module-level singleton manager cache
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const managerCache = new WeakMap<SoundManifest, AudioManager<any>>();
let globalInitialized = false;

/**
 * Hook to use audio with a sound manifest
 * Creates a singleton AudioManager for the manifest and handles socket injection
 * @param manifest The sound manifest configuration
 * @returns The AudioManager instance with type-safe sound IDs
 */
export function useAudio<M extends SoundManifest>(
  manifest: M,
): AudioManager<keyof M & string> {
  const roomId = useConnectionStore((state) => state.roomId);
  const role = useConnectionStore((state) => state.role);
  const initRef = useRef(false);

  // Get or create singleton manager for this manifest
  type SoundId = keyof M & string;
  let manager = managerCache.get(manifest) as AudioManager<SoundId> | undefined;
  if (!manager) {
    manager = new AudioManager<SoundId>(manifest);
    managerCache.set(manifest, manager);
  }

  // Inject socket into manager when connection is available
  useEffect(() => {
    if (role && roomId) {
      const socket = getSocketClient(role);
      manager.setSocket(socket, roomId);
    }
  }, [manager, role, roomId]);

  // Ensure audio context is resumed on first interaction (only once globally)
  useEffect(() => {
    if (initRef.current || globalInitialized) return;

    const handleInteraction = () => {
      manager.init();
      globalInitialized = true;
      initRef.current = true;
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);
    window.addEventListener("keydown", handleInteraction);

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [manager]);

  return manager;
}

// Legacy exports for backward compatibility (can be removed later)
const LegacyAudioContext = createContext<AudioManager | null>(null);

export const AudioProvider = ({
  children,
  manager,
}: {
  children: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  manager: AudioManager<any>;
}) => {
  const roomId = useConnectionStore((state) => state.roomId);
  const role = useConnectionStore((state) => state.role);

  // Inject socket into manager
  useEffect(() => {
    if (role && roomId) {
      const socket = getSocketClient(role);
      manager.setSocket(socket, roomId);
    }
  }, [manager, role, roomId]);

  // Ensure audio context is resumed on first interaction
  useEffect(() => {
    const handleInteraction = () => {
      manager.init();
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);
    window.addEventListener("keydown", handleInteraction);

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [manager]);

  return (
    <LegacyAudioContext.Provider value={manager}>
      {children}
    </LegacyAudioContext.Provider>
  );
};

export const useAudioLegacy = <T extends string = string>() => {
  const manager = useContext(LegacyAudioContext);
  if (!manager) {
    throw new Error("useAudioLegacy must be used within an AudioProvider");
  }
  return manager as AudioManager<T>;
};

/**
 * Hook to create a stable AudioManager instance
 */
export const useAudioManager = <T extends string = string>(
  manifest: SoundManifest,
) => {
  const managerRef = useRef<AudioManager<T> | null>(null);

  if (!managerRef.current) {
    managerRef.current = new AudioManager<T>(manifest);
  }

  return managerRef.current;
};
