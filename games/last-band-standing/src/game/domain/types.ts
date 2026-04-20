import { z } from "zod";

export const roundEndPolicies = ["rapid", "wait-for-all"] as const;

export const roundEndPolicySchema = z.enum(roundEndPolicies);

export type RoundEndPolicy = z.infer<typeof roundEndPolicySchema>;

export const roundGuessKinds = ["song-title", "artist"] as const;

export const roundGuessKindSchema = z.enum(roundGuessKinds);

export type RoundGuessKind = z.infer<typeof roundGuessKindSchema>;

export const gamePhaseSchema = z.enum([
  "lobby",
  "round-active",
  "round-reveal",
  "game-over",
]);

export type GamePhase = z.infer<typeof gamePhaseSchema>;
