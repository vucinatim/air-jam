import type { DeviceWakeEvents } from "./session-link";

/** The browser's own online and visibility events. */
export const browserDeviceWakeEvents: DeviceWakeEvents = (wake) => {
  const onVisibility = () => {
    if (document.visibilityState === "visible") wake();
  };
  window.addEventListener("online", wake);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("online", wake);
    document.removeEventListener("visibilitychange", onVisibility);
  };
};
