import { type RoundGuessKind } from "@/game/domain/types";

export const getRoundPrompt = (guessKind: RoundGuessKind): string => {
  return guessKind === "artist" ? "Who is the artist?" : "What song is this?";
};

export const optionColors = [
  "bg-[var(--airjam-color-destructive)] active:bg-[var(--airjam-color-answer-red-pressed)]",
  "bg-[var(--airjam-color-answer-blue)] active:bg-[var(--airjam-color-answer-blue-pressed)]",
  "bg-[var(--airjam-color-answer-green)] active:bg-[var(--airjam-color-answer-green-pressed)]",
  "bg-[var(--airjam-color-answer-orange)] active:bg-[var(--airjam-color-answer-orange-pressed)]",
];
