import {
  DEFAULT_SURFACE_SETTINGS,
  type AirJamSurfaceSettings,
} from "./platform-settings";

// One page shows one surface, so its resolved settings are one value every
// SDK piece reads: audio, vibration and the document's presentation.
let current: AirJamSurfaceSettings = DEFAULT_SURFACE_SETTINGS;
const listeners = new Set<() => void>();

/** The settings that apply to this page right now. */
export const readAirJamSurfaceSettings = (): AirJamSurfaceSettings => current;

export const publishSurfaceSettings = (next: AirJamSurfaceSettings): void => {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
};

export const subscribeSurfaceSettings = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
