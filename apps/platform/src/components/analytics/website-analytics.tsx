import Script from "next/script";

const DEFAULT_UMAMI_SCRIPT_URL = "https://cloud.umami.is/script.js";

const readAnalyticsProvider = (): string =>
  process.env.NEXT_PUBLIC_WEBSITE_ANALYTICS_PROVIDER?.trim().toLowerCase() ??
  "none";

export const WebsiteAnalytics = () => {
  if (readAnalyticsProvider() !== "umami") {
    return null;
  }

  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();
  if (!websiteId) {
    return null;
  }

  const scriptSrc =
    process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL?.trim() ??
    DEFAULT_UMAMI_SCRIPT_URL;

  return (
    <Script
      id="umami-analytics"
      src={scriptSrc}
      data-website-id={websiteId}
      strategy="afterInteractive"
    />
  );
};
