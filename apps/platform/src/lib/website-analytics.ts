"use client";

type AnalyticsEventPayload =
  | string
  | number
  | boolean
  | null
  | undefined
  | AnalyticsEventPayload[]
  | { [key: string]: AnalyticsEventPayload };

type AnalyticsEventData = Record<string, AnalyticsEventPayload>;

type UmamiTracker = {
  track: {
    (): void;
    (eventName: string): void;
    (eventName: string, data: AnalyticsEventData): void;
  };
};

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

export const trackWebsiteEvent = (
  eventName: string,
  data?: AnalyticsEventData,
): void => {
  if (typeof window === "undefined") {
    return;
  }

  const tracker = window.umami;
  if (!tracker || typeof tracker.track !== "function") {
    return;
  }

  if (data === undefined) {
    tracker.track(eventName);
    return;
  }

  tracker.track(eventName, data);
};
