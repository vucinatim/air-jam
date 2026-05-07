const FULL_STACK_PREVIEW_HOST_PATTERN = /^full-pr-\d+\./i;

const normalizeHost = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.toLowerCase();
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
  activePreviewHost,
}: {
  requestHost: string | null | undefined;
  activePreviewHost: string | null | undefined;
}): boolean => {
  const normalizedRequestHost = normalizeHost(requestHost);
  if (!normalizedRequestHost) {
    return false;
  }

  if (!isManagedFullStackPreviewHost(normalizedRequestHost)) {
    return false;
  }

  const normalizedActivePreviewHost = normalizeHost(activePreviewHost);
  if (!normalizedActivePreviewHost) {
    return true;
  }

  return normalizedRequestHost !== normalizedActivePreviewHost;
};
