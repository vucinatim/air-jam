import { useGameStore } from "@/game/stores";
import { useAirJamController, useAudio } from "@air-jam/sdk";
import { useEffect, useRef } from "react";

export const useControllerAudioCues = () => {
  const audio = useAudio();
  const controllerId = useAirJamController((state) => state.controllerId);
  const phase = useGameStore((state) => state.phase);
  const roundReveal = useGameStore((state) => state.roundReveal);
  const previousPhaseRef = useRef<string>(phase);

  const myRoundResult =
    controllerId && roundReveal
      ? (roundReveal.resultsByPlayerId[controllerId] ?? null)
      : null;

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    previousPhaseRef.current = phase;
    if (previousPhase === phase) return;

    if (phase === "round-reveal" && myRoundResult) {
      audio.play(myRoundResult.isCorrect ? "correct" : "wrong");
    }

    if (phase === "game-over") {
      audio.play("victory");
    }
  }, [audio, phase, myRoundResult]);
};
