import { roomCodeSchema } from "../protocol";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CONTROLLER_ID_RANDOM_LENGTH = 20;
let fallbackControllerSequence = 0;

const generateRandomAlphabetValue = (length: number): string => {
  const values = new Uint32Array(length);
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    crypto.getRandomValues(values);
    return Array.from(
      values,
      (value) => alphabet[value % alphabet.length],
    ).join("");
  }

  return Array.from(
    { length },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
};

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
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `C${crypto.randomUUID().replaceAll("-", "")}`;
  }

  const sequence = fallbackControllerSequence++;
  return `C${Date.now().toString(36)}${sequence.toString(36)}${generateRandomAlphabetValue(
    CONTROLLER_ID_RANDOM_LENGTH,
  )}`;
};
