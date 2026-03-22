import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { useAirJamContext } from "../context/air-jam-context";
import { useAssertSessionScope } from "../context/session-providers";
import type { PlaySoundPayload } from "../protocol";
import { AudioManager, SoundManifest } from "./audio-manager";
import { initializeParentSettingsSync } from "./volume-store";

// Module-level singleton manager cache
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const managerCache = new WeakMap<SoundManifest, AudioManager<any>>();
let globalInitialized = false;
let settingsSyncInitialized = false;

/**
 * Hook to use audio with a sound manifest
 * Creates a singleton AudioManager for the manifest and handles socket injection
 * @param manifest The sound manifest configuration
 * @returns The AudioManager instance with type-safe sound IDs
 */
export function useAudio<M extends SoundManifest>(
  manifest: M,
): AudioManager<keyof M & string> {
  const { store, getSocket } = useAirJamContext();
  const roomId = useStore(store, (state) => state.roomId);
  const role = useStore(store, (state) => state.role);
  const initRef = useRef(false);

  // Get or create singleton manager for this manifest
  type SoundId = keyof M & string;
  let manager = managerCache.get(manifest) as AudioManager<SoundId> | undefined;
  if (!manager) {
    manager = new AudioManager<SoundId>(manifest);
    managerCache.set(manifest, manager);
  }

  // Explicit runtime adapter initialization for iframe settings sync.
  useEffect(() => {
    if (settingsSyncInitialized) return;
    initializeParentSettingsSync();
    settingsSyncInitialized = true;
  }, []);

  // Inject socket into manager when connection is available
  useEffect(() => {
    if (role && roomId) {
      const socket = getSocket(role);
      manager.setSocket(socket, roomId);
    }
  }, [manager, role, roomId, getSocket]);

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

export const isManifestSoundId = <M extends SoundManifest>(
  manifest: M,
  soundId: unknown,
): soundId is keyof M & string => {
  return (
    typeof soundId === "string" &&
    Object.prototype.hasOwnProperty.call(manifest, soundId)
  );
};

export interface UseRemoteSoundOptions {
  enabled?: boolean;
}

/**
 * Listen for host-triggered remote sound events and play them locally
 * on the active controller session.
 */
export const useRemoteSound = <M extends SoundManifest>(
  manifest: M,
  audio: AudioManager<keyof M & string>,
  options: UseRemoteSoundOptions = {},
): void => {
  useAssertSessionScope("controller", "useRemoteSound");

  const { getSocket } = useAirJamContext();
  const socket = useMemo(() => getSocket("controller"), [getSocket]);
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!socket || !enabled) {
      return;
    }

    const handlePlaySound = (payload: PlaySoundPayload): void => {
      if (!isManifestSoundId(manifest, payload.id)) {
        return;
      }

      audio.play(payload.id, {
        volume: payload.volume,
        loop: payload.loop,
      });
    };

    socket.on("server:playSound", handlePlaySound);
    return () => {
      socket.off("server:playSound", handlePlaySound);
    };
  }, [audio, enabled, manifest, socket]);
};
