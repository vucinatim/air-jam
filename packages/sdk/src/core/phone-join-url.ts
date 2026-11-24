export const PHONE_JOIN_UNAVAILABLE_MESSAGE =
  "Phones cannot join from an address only this computer can open.";

export const resolvePhoneJoinUrl = (
  value: string | null | undefined,
): string | null => {
  if (!value?.trim()) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const hostname = url.hostname;
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "[::1]" ||
    hostname.startsWith("127.")
  ) {
    return null;
  }

  return value.trim();
};
