import { roomCodeSchema } from "../protocol";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generateRoomCode = (): string => {
  const array = new Uint32Array(4);
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i += 1) {
      array[i] = Math.floor(Math.random() * alphabet.length);
    }
  }

  const code = Array.from(
    array,
    (value) => alphabet[value % alphabet.length],
  ).join("");
  return roomCodeSchema.parse(code);
};

export const generateControllerId = (): string => {
  const stamp = Math.floor(Date.now() % 100000)
    .toString()
    .padStart(5, "0");
  const random = alphabet[Math.floor(Math.random() * alphabet.length)];
  return `C${random}${stamp}`;
};

/**
 * A safe fallback for crypto.randomUUID() which is not available in all environments
 * (e.g. non-secure contexts or some browser extensions).
 */
export const safeRandomUUID = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // Fallback implementation (RFC4122 v4 compliant-ish)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
