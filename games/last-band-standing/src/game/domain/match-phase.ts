import type { GamePhase } from "@/game/domain/types";
import type { ShellMatchPhase } from "@air-jam/sdk";

export const toShellMatchPhase = (phase: GamePhase): ShellMatchPhase => {
  if (phase === "round-active" || phase === "round-reveal") {
    return "playing";
  }

  if (phase === "game-over") {
    return "ended";
  }

  return "lobby";
};
