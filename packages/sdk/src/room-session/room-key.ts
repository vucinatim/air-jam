/**
 * A device's key: 128 random bits it stores before it first connects. The
 * same key always means the same host or seat, so the caller keeps it for as
 * long as it wants that place back.
 */
export const createRoomKey = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
