import { useGetInput, useRoom } from "@air-jam/sdk";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useBotManager } from "../bot-system/bot-manager";
import { usePrototypeMatchStore } from "../stores/match/match-store";
import { type GameLoopInput, gameInputSchema } from "../types";

export const useGameInput = () => {
  // Get getInput without subscribing to connection state
  const getInputFromHost = useGetInput<typeof gameInputSchema>();
  const botManager = useBotManager.getState();
  const { runtimeState } = useRoom();
  const matchPhase = usePrototypeMatchStore((state) => state.matchPhase);

  // We need time for bot updates
  const timeRef = useRef(0);

  useFrame((state) => {
    timeRef.current = state.clock.elapsedTime;
  });

  const popInput = (controllerId: string): GameLoopInput | undefined => {
    if (
      runtimeState !== "playing" ||
      (matchPhase !== "countdown" && matchPhase !== "playing")
    ) {
      return undefined;
    }

    const input = controllerId.startsWith("bot-")
      ? botManager.getBotInput(controllerId, 1 / 60, timeRef.current)
      : getInputFromHost(controllerId);

    if (!input) {
      return undefined;
    }

    const baseInput = {
      vector: input.vector ?? { x: 0, y: 0 },
      action: input.action ?? false,
      ability: input.ability ?? false,
      timestamp: input.timestamp ?? Date.now(),
    };

    if (matchPhase === "countdown") {
      return {
        ...baseInput,
        vector: {
          x: baseInput.vector.x,
          y: 0,
        },
        action: false,
        ability: false,
      };
    }

    return baseInput;
  };

  return { popInput };
};
