const FULL_STACK_PREVIEW_HOST_PATTERN = /^full-pr-\d+\./i;

const normalizeHost = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.toLowerCase();
};

const extractHostFromUrl = (rawUrl: string | null | undefined): string | null => {
  const trimmed = rawUrl?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return normalizeHost(new URL(trimmed).host);
  } catch {
    return null;
  }
};

export const isManagedFullStackPreviewHost = (
  requestHost: string | null | undefined,
): boolean => {
  const normalizedHost = normalizeHost(requestHost);
  if (!normalizedHost) {
    return false;
  }

  return FULL_STACK_PREVIEW_HOST_PATTERN.test(normalizedHost);
};

export const isInactiveFullStackPreviewRequest = ({
  requestHost,
  configuredPlatformPublicUrl,
}: {
  requestHost: string | null | undefined;
  configuredPlatformPublicUrl: string | null | undefined;
}): boolean => {
  const normalizedRequestHost = normalizeHost(requestHost);
  if (!normalizedRequestHost) {
    return false;
  }

  if (!isManagedFullStackPreviewHost(normalizedRequestHost)) {
    return false;
  }

  const configuredHost = extractHostFromUrl(configuredPlatformPublicUrl);
  if (!configuredHost) {
    return true;
  }

  return normalizedRequestHost !== configuredHost;
};
