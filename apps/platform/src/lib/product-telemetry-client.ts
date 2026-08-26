"use client";

import {
  PRODUCT_TELEMETRY_MAX_BATCH_SIZE,
  PRODUCT_TELEMETRY_MAX_REQUEST_BYTES,
  PRODUCT_TELEMETRY_SCHEMA_VERSION,
  productTelemetryBrowserEventSchema,
  type ProductTelemetryBrowserEvent,
  type ProductTelemetryExternalTarget,
  type ProductTelemetryPlacement,
} from "@/lib/product-telemetry-contract";

const PRODUCT_TELEMETRY_ENDPOINT = "/api/telemetry";
const DEFAULT_BATCH_DELAY_MS = 750;
const CAMPAIGN_VALUE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

type ProductTelemetryCampaign = NonNullable<
  ProductTelemetryBrowserEvent["campaign"]
>;

type ProductTelemetrySessionContext = {
  anonymousSessionId: string;
  referrerHost?: string;
  campaign?: ProductTelemetryCampaign;
};

type ProductTelemetryEventInput =
  | { kind: "page_view"; pathname: string }
  | { kind: "quick_start_opened"; placement: ProductTelemetryPlacement }
  | {
      kind: "scaffold_command_copied";
      placement: ProductTelemetryPlacement;
    }
  | { kind: "arcade_entered"; placement: ProductTelemetryPlacement }
  | {
      kind: "external_link_opened";
      placement: ProductTelemetryPlacement;
      target: ProductTelemetryExternalTarget;
    };

type ProductTelemetryBrowserContext = {
  pathname: string;
  search: string;
  referrer: string;
};

type ProductTelemetryBatchSender = (
  events: ProductTelemetryBrowserEvent[],
  preferBeacon: boolean,
) => void;

type ProductTelemetryClientOptions = {
  batchDelayMs?: number;
  createUuid: () => string | undefined;
  now: () => Date;
  readBrowserContext: () => ProductTelemetryBrowserContext | undefined;
  sendBatch: ProductTelemetryBatchSender;
  setTimer: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>;
  clearTimer: (timer: ReturnType<typeof setTimeout>) => void;
};

export type ProductTelemetryClient = {
  flush: (preferBeacon?: boolean) => void;
  trackArcadeEntered: (placement: ProductTelemetryPlacement) => void;
  trackExternalLinkOpened: (
    placement: ProductTelemetryPlacement,
    target: ProductTelemetryExternalTarget,
  ) => void;
  trackPageView: (pathname: string) => void;
  trackQuickStartOpened: (placement: ProductTelemetryPlacement) => void;
  trackScaffoldCommandCopied: (placement: ProductTelemetryPlacement) => void;
};

const normalizeCampaignValue = (value: string | null): string | undefined => {
  const normalized = value?.trim().toLowerCase();
  return normalized && CAMPAIGN_VALUE_PATTERN.test(normalized)
    ? normalized
    : undefined;
};

export const normalizeTelemetryCampaign = (
  search: string,
): ProductTelemetryCampaign | undefined => {
  const params = new URLSearchParams(search);
  const campaign = {
    source: normalizeCampaignValue(params.get("utm_source")),
    medium: normalizeCampaignValue(params.get("utm_medium")),
    campaign: normalizeCampaignValue(params.get("utm_campaign")),
  };

  if (
    campaign.source === undefined &&
    campaign.medium === undefined &&
    campaign.campaign === undefined
  ) {
    return undefined;
  }

  return campaign;
};

export const normalizeTelemetryReferrerHost = (
  referrer: string,
): string | undefined => {
  if (!referrer) {
    return undefined;
  }

  try {
    const url = new URL(referrer);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    return /^[A-Za-z0-9.-]{1,253}$/.test(hostname) ? hostname : undefined;
  } catch {
    return undefined;
  }
};

export const normalizeTelemetryPathname = (
  pathname: string,
): string | undefined => {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] ?? "";
  const normalized =
    withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : withoutQuery;

  return /^\/[A-Za-z0-9/_.-]*$/.test(normalized) && normalized.length <= 180
    ? normalized
    : undefined;
};

export const createProductTelemetryClient = (
  options: ProductTelemetryClientOptions,
): ProductTelemetryClient => {
  const queue: ProductTelemetryBrowserEvent[] = [];
  const batchDelayMs = options.batchDelayMs ?? DEFAULT_BATCH_DELAY_MS;
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  let sessionContext: ProductTelemetrySessionContext | undefined;
  let lastPageViewPathname: string | undefined;

  const takeNextBatch = (): ProductTelemetryBrowserEvent[] => {
    const events: ProductTelemetryBrowserEvent[] = [];

    while (
      queue.length > 0 &&
      events.length < PRODUCT_TELEMETRY_MAX_BATCH_SIZE
    ) {
      const next = queue[0];
      if (!next) {
        break;
      }

      const candidate = [...events, next];
      const requestBytes = JSON.stringify({ events: candidate }).length;
      if (requestBytes > PRODUCT_TELEMETRY_MAX_REQUEST_BYTES) {
        if (events.length === 0) {
          queue.shift();
        }
        break;
      }

      events.push(next);
      queue.shift();
    }

    return events;
  };

  const readSessionContext = (): ProductTelemetrySessionContext | undefined => {
    if (sessionContext) {
      return sessionContext;
    }

    const anonymousSessionId = options.createUuid();
    const browserContext = options.readBrowserContext();
    if (!anonymousSessionId || !browserContext) {
      return undefined;
    }

    sessionContext = {
      anonymousSessionId,
      referrerHost: normalizeTelemetryReferrerHost(browserContext.referrer),
      campaign: normalizeTelemetryCampaign(browserContext.search),
    };
    return sessionContext;
  };

  const flush = (preferBeacon = false): void => {
    if (flushTimer !== undefined) {
      options.clearTimer(flushTimer);
      flushTimer = undefined;
    }

    while (queue.length > 0) {
      const events = takeNextBatch();
      if (events.length === 0) {
        continue;
      }
      try {
        options.sendBatch(events, preferBeacon);
      } catch {
        // Product telemetry is best-effort evidence and must never affect UX.
      }
    }
  };

  const scheduleFlush = (): void => {
    if (flushTimer !== undefined) {
      return;
    }

    flushTimer = options.setTimer(() => {
      flushTimer = undefined;
      flush();
    }, batchDelayMs);
  };

  const track = (input: ProductTelemetryEventInput): boolean => {
    const browserContext = options.readBrowserContext();
    const context = readSessionContext();
    const id = options.createUuid();
    const pathname = normalizeTelemetryPathname(
      input.kind === "page_view"
        ? input.pathname
        : (browserContext?.pathname ?? ""),
    );
    if (!context || !id || !pathname) {
      return false;
    }

    const parsed = productTelemetryBrowserEventSchema.safeParse({
      ...input,
      id,
      schemaVersion: PRODUCT_TELEMETRY_SCHEMA_VERSION,
      occurredAt: options.now().toISOString(),
      anonymousSessionId: context.anonymousSessionId,
      pathname,
      referrerHost: context.referrerHost,
      campaign: context.campaign,
    });
    if (!parsed.success) {
      return false;
    }

    queue.push(parsed.data);
    if (queue.length >= PRODUCT_TELEMETRY_MAX_BATCH_SIZE) {
      flush();
      return true;
    }
    scheduleFlush();
    return true;
  };

  return {
    flush,
    trackArcadeEntered: (placement) =>
      track({ kind: "arcade_entered", placement }),
    trackExternalLinkOpened: (placement, target) =>
      track({ kind: "external_link_opened", placement, target }),
    trackPageView: (pathname) => {
      const normalized = normalizeTelemetryPathname(pathname);
      if (!normalized || normalized === lastPageViewPathname) {
        return;
      }
      if (track({ kind: "page_view", pathname: normalized })) {
        lastPageViewPathname = normalized;
      }
    },
    trackQuickStartOpened: (placement) =>
      track({ kind: "quick_start_opened", placement }),
    trackScaffoldCommandCopied: (placement) =>
      track({ kind: "scaffold_command_copied", placement }),
  };
};

const createBrowserUuid = (): string | undefined => {
  if (typeof window === "undefined" || !window.crypto) {
    return undefined;
  }

  if (typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
};

const readBrowserContext = (): ProductTelemetryBrowserContext | undefined => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return undefined;
  }

  return {
    pathname: window.location.pathname,
    search: window.location.search,
    referrer: document.referrer,
  };
};

const sendBrowserBatch: ProductTelemetryBatchSender = (
  events,
  preferBeacon,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const body = JSON.stringify({ events });
  if (preferBeacon && typeof window.navigator.sendBeacon === "function") {
    try {
      const accepted = window.navigator.sendBeacon(
        PRODUCT_TELEMETRY_ENDPOINT,
        new Blob([body], { type: "application/json" }),
      );
      if (accepted) {
        return;
      }
    } catch {
      // Fall through to the same-origin keepalive request.
    }
  }

  void window
    .fetch(PRODUCT_TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      credentials: "same-origin",
      keepalive: true,
    })
    .catch(() => undefined);
};

const browserProductTelemetryClient = createProductTelemetryClient({
  createUuid: createBrowserUuid,
  now: () => new Date(),
  readBrowserContext,
  sendBatch: sendBrowserBatch,
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer: (timer) => clearTimeout(timer),
});

export const trackProductPageView = (pathname: string): void => {
  browserProductTelemetryClient.trackPageView(pathname);
};

export const trackQuickStartOpened = (
  placement: ProductTelemetryPlacement,
): void => {
  browserProductTelemetryClient.trackQuickStartOpened(placement);
};

export const trackScaffoldCommandCopied = (
  placement: ProductTelemetryPlacement,
): void => {
  browserProductTelemetryClient.trackScaffoldCommandCopied(placement);
};

export const trackArcadeEntered = (
  placement: ProductTelemetryPlacement,
): void => {
  browserProductTelemetryClient.trackArcadeEntered(placement);
};

export const trackExternalLinkOpened = (
  placement: ProductTelemetryPlacement,
  target: ProductTelemetryExternalTarget,
): void => {
  browserProductTelemetryClient.trackExternalLinkOpened(placement, target);
};

export const startProductTelemetryBrowserCollection = (): (() => void) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => undefined;
  }

  const flushForNavigation = () => browserProductTelemetryClient.flush(true);
  const flushWhenHidden = () => {
    if (document.visibilityState === "hidden") {
      flushForNavigation();
    }
  };

  window.addEventListener("pagehide", flushForNavigation);
  document.addEventListener("visibilitychange", flushWhenHidden);

  return () => {
    window.removeEventListener("pagehide", flushForNavigation);
    document.removeEventListener("visibilitychange", flushWhenHidden);
    flushForNavigation();
  };
};
