import type { PlayerProfilePatch } from "@air-jam/sdk";

import { CONTROLLER_AVATAR_PRESETS } from "@/lib/controller-profile-presets";

export type ControllerPersistedProfile = {
  label: string;
  avatarId: string;
};

const STORAGE_KEY = "airjam.controller.playerProfile";

/** Server snapshot and hydration fallback; must match `createDefaultControllerPersistedProfile()` values. */
const serverDefaultSnapshot: ControllerPersistedProfile = Object.freeze({
  label: "Player",
  avatarId: CONTROLLER_AVATAR_PRESETS[0].id,
});

let clientSnapshotCache: ControllerPersistedProfile | null = null;
let clientSnapshotKey = "";

/**
 * Mutable copy for form state (e.g. initial `useState`); same values as SSR default.
 */
export const createDefaultControllerPersistedProfile = (): ControllerPersistedProfile => ({
  label: serverDefaultSnapshot.label,
  avatarId: serverDefaultSnapshot.avatarId,
});

export const getControllerLocalProfileServerSnapshot = (): ControllerPersistedProfile =>
  serverDefaultSnapshot;

const profileListeners = new Set<() => void>();

/** Call after writing profile to localStorage (same-tab updates are not a StorageEvent). */
export const notifyControllerLocalProfileChanged = (): void => {
  for (const listener of profileListeners) {
    listener();
  }
};

/**
 * For useSyncExternalStore: cross-tab updates via `storage`, same-tab via {@link notifyControllerLocalProfileChanged}.
 */
export const subscribeControllerLocalProfile = (onStoreChange: () => void): (() => void) => {
  profileListeners.add(onStoreChange);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    profileListeners.delete(onStoreChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
};

export const readControllerLocalProfile = (): ControllerPersistedProfile | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("label" in parsed) ||
      !("avatarId" in parsed)
    ) {
      return null;
    }
    const label = String((parsed as { label: unknown }).label).trim();
    const avatarId = String((parsed as { avatarId: unknown }).avatarId).trim();
    if (!label || !avatarId) {
      return null;
    }
    return { label, avatarId };
  } catch {
    return null;
  }
};

/**
 * Client snapshot for `useSyncExternalStore`, with stable referential equality when values are unchanged.
 */
export const getControllerLocalProfileClientSnapshot = (): ControllerPersistedProfile => {
  const fromRead = readControllerLocalProfile();
  const merged = fromRead ?? serverDefaultSnapshot;
  const key = `${merged.label}\0${merged.avatarId}`;
  if (clientSnapshotCache && key === clientSnapshotKey) {
    return clientSnapshotCache;
  }
  clientSnapshotKey = key;
  if (
    key ===
    `${serverDefaultSnapshot.label}\0${serverDefaultSnapshot.avatarId}`
  ) {
    clientSnapshotCache = serverDefaultSnapshot;
  } else {
    clientSnapshotCache = merged;
  }
  return clientSnapshotCache;
};

export const writeControllerLocalProfile = (
  profile: ControllerPersistedProfile,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  notifyControllerLocalProfileChanged();
};

export const toProfilePatch = (
  profile: ControllerPersistedProfile,
): PlayerProfilePatch => ({
  label: profile.label,
  avatarId: profile.avatarId,
});
