import { useCallback, useEffect, useMemo, useState } from "react";

const HOST_AUDIO_MUTE_STORAGE_KEY_PREFIX = "air-jam-host-audio-muted:";

const getHostAudioMuteStorageKey = (scope: string): string =>
  `${HOST_AUDIO_MUTE_STORAGE_KEY_PREFIX}${scope}`;

const readHostAudioMutePreference = (
  storageKey: string,
  fallback: boolean,
): boolean => {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  return fallback;
};

const persistHostAudioMutePreference = (
  storageKey: string,
  muted: boolean,
): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, muted ? "true" : "false");
};

export interface HostAudioMutePreference {
  muted: boolean;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
}

export const useHostAudioMutePreference = (
  scope: string,
  defaultMuted = false,
): HostAudioMutePreference => {
  const storageKey = useMemo(() => getHostAudioMuteStorageKey(scope), [scope]);
  const [muted, setMutedState] = useState<boolean>(() =>
    readHostAudioMutePreference(storageKey, defaultMuted),
  );

  useEffect(() => {
    setMutedState(readHostAudioMutePreference(storageKey, defaultMuted));
  }, [defaultMuted, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) {
        return;
      }
      if (event.key !== storageKey) {
        return;
      }

      setMutedState(readHostAudioMutePreference(storageKey, defaultMuted));
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [defaultMuted, storageKey]);

  const setMuted = useCallback(
    (nextMuted: boolean) => {
      setMutedState(nextMuted);
      persistHostAudioMutePreference(storageKey, nextMuted);
    },
    [storageKey],
  );

  const toggleMuted = useCallback(() => {
    setMutedState((current) => {
      const nextMuted = !current;
      persistHostAudioMutePreference(storageKey, nextMuted);
      return nextMuted;
    });
  }, [storageKey]);

  return {
    muted,
    setMuted,
    toggleMuted,
  };
};
