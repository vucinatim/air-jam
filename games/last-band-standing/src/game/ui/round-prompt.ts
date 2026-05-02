import { type RoundGuessKind } from "@/game/domain/types";

export const getRoundPrompt = (guessKind: RoundGuessKind): string => {
  return guessKind === "artist" ? "Who is the artist?" : "What song is this?";
};

export const optionColors = [
  "bg-[#e74c3c] active:bg-[#c0392b]",
  "bg-[#2980b9] active:bg-[#1f6da0]",
  "bg-[#27ae60] active:bg-[#1e8c4c]",
  "bg-[#f39c12] active:bg-[#d68910]",
];
