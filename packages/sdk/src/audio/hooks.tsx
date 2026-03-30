import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useStore } from "zustand";
import { useAirJamContext } from "../context/air-jam-context";
import { useAssertSessionScope } from "../context/session-providers";
import type { PlaySoundPayload } from "../protocol";
import {
  getControllerRealtimeClient,
} from "../runtime/controller-realtime-client";
import { getHostRealtimeClient } from "../runtime/host-realtime-client";
import { AudioManager, SoundManifest } from "./audio-manager";
import { initializeParentSettingsSync } from "./volume-store";

// Module-level singleton manager cache
const managerCache = new WeakMap<SoundManifest, AudioManager<string>>();
let globalInitialized = false;
let settingsSyncInitialized = false;
const audioManagerContext = createContext<AudioManager<string> | null>(null);

export interface AudioProviderProps<T extends string = string> {
  manager: AudioManager<T>;
  children: ReactNode;
}

/**
 * Provide a runtime-owned AudioManager to descendant hooks/components.
 * Use this after creating the manager once at the host/controller boundary.
 */
export function AudioProvider<T extends string = string>({
  manager,
  children,
}: AudioProviderProps<T>) {
  return (
    <audioManagerContext.Provider value={manager as AudioManager<string>}>
      {children}
    </audioManagerContext.Provider>
  );
}

/**
 * Consume the runtime-owned AudioManager from AudioProvider.
 */
export function useProvidedAudio<T extends string = string>(): AudioManager<T> {
  const manager = useContext(audioManagerContext);

  if (!manager) {
    throw new Error("useProvidedAudio must be used within an AudioProvider");
  }

  return manager as AudioManager<T>;
}

/**
 * Hook to use audio with a sound manifest
 * Creates a singleton AudioManager for the manifest and handles socket injection.
 * This is the owner-level primitive and should be called once per runtime surface.
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
      const socket =
        role === "controller"
          ? getControllerRealtimeClient((runtimeRole) => getSocket(runtimeRole))
          : getHostRealtimeClient((runtimeRole) => getSocket(runtimeRole));
      manager.setSocket(socket, roomId, role);
    }
  }, [manager, role, roomId, getSocket]);

  // Ensure audio context is resumed on first interaction (only once globally)
  useEffect(() => {
    if (initRef.current || globalInitialized) return;

    const handleInteraction = () => {
      void manager.init().then((ready) => {
        if (!ready) {
          return;
        }

        globalInitialized = true;
        initRef.current = true;
        window.removeEventListener("click", handleInteraction);
        window.removeEventListener("touchstart", handleInteraction);
        window.removeEventListener("keydown", handleInteraction);
        window.removeEventListener("pointerdown", handleInteraction);
        window.removeEventListener("mousedown", handleInteraction);
      });
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    window.addEventListener("pointerdown", handleInteraction);
    window.addEventListener("mousedown", handleInteraction);

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("mousedown", handleInteraction);
    };
  }, [manager]);

  return manager;
}

/**
 * Hook to create a stable AudioManager instance
 */
export const useAudioManager = <T extends string = string>(
  manifest?: SoundManifest,
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
  const socket = useMemo(
    () => getControllerRealtimeClient((role) => getSocket(role)),
    [getSocket],
  );
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
