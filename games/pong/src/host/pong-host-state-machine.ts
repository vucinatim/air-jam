import type { PongState } from "../game/stores";

export type PongHostPhaseEffect =
  | "start-countdown"
  | "clear-countdown"
  | "reset-match-buffers"
  | "reset-ball";

export const getPongHostPhaseEffects = ({
  previousPhase,
  matchPhase,
}: {
  previousPhase: PongState["matchPhase"];
  matchPhase: PongState["matchPhase"];
}): PongHostPhaseEffect[] => {
  if (previousPhase === matchPhase) {
    return [];
  }

  const effects: PongHostPhaseEffect[] = [];

  if (previousPhase !== "playing" && matchPhase === "playing") {
    effects.push("reset-match-buffers", "start-countdown");
  }

  if (previousPhase === "playing" && matchPhase !== "playing") {
    effects.push("clear-countdown");
  }

  if (previousPhase === "ended" && matchPhase === "lobby") {
    effects.push("reset-ball");
  }

  return effects;
};
