/**
 * Extracts a room code from a scanned QR string (full URL or raw code).
 */
export const parseRoomFromQrText = (text: string): string | null => {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const room =
      url.searchParams.get("room") ?? url.searchParams.get("aj_room");
    if (room) {
      return room
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 8);
    }
  } catch {
    // not a URL
  }

  const compact = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length >= 4 && compact.length <= 8) {
    return compact;
  }

  return null;
};
