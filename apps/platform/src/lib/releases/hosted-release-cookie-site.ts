const normalizeHostname = (hostname: string): string =>
  hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");

const isIpAddress = (hostname: string): boolean =>
  /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");

/**
 * Conservative cookie-site boundary used by configuration and deployed
 * attestation. The final two labels deliberately reject sibling subdomains;
 * hosted release delivery must use a visibly independent cookie site.
 */
export const resolveConservativeCookieSite = (hostname: string): string => {
  const normalized = normalizeHostname(hostname);
  if (!normalized || normalized === "localhost" || isIpAddress(normalized)) {
    return normalized;
  }

  const labels = normalized.split(".").filter(Boolean);
  return labels.length <= 2 ? normalized : labels.slice(-2).join(".");
};

export const inspectHostedReleaseCookieSiteIsolation = ({
  platformHostname,
  releaseHostname,
}: {
  platformHostname: string;
  releaseHostname: string;
}) => {
  const platformCookieSite = resolveConservativeCookieSite(platformHostname);
  const releaseCookieSite = resolveConservativeCookieSite(releaseHostname);
  return {
    isolated:
      Boolean(platformCookieSite) &&
      Boolean(releaseCookieSite) &&
      platformCookieSite !== releaseCookieSite,
    platformCookieSite,
    releaseCookieSite,
  };
};
