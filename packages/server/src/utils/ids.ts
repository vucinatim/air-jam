import { roomCodeSchema } from "@air-jam/sdk/protocol";
import { randomInt } from "node:crypto";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generate a random 4-character room code.
 * Uses Node.js crypto for secure random generation.
 */
export const generateRoomCode = (): string => {
  const code = Array.from(
    { length: 4 },
    () => alphabet[randomInt(0, alphabet.length)],
  ).join("");

  return roomCodeSchema.parse(code);
};
