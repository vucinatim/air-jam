import {
  useGetInput,
  useRoom,
} from "@air-jam/sdk";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useBotManager } from "../bot-system/bot-manager";
import { usePrototypeMatchStore } from "../stores/match/match-store";
import { type GameLoopInput, gameInputSchema } from "../types";

export const useGameInput = () => {
  // Get getInput without subscribing to connection state
  const getInputFromHost = useGetInput<typeof gameInputSchema>();
  const botManager = useBotManager.getState();
  const { gameState } = useRoom();
  const matchPhase = usePrototypeMatchStore((state) => state.matchPhase);

  // We need time for bot updates
  const timeRef = useRef(0);

  useFrame((state) => {
    timeRef.current = state.clock.elapsedTime;
  });

  const popInput = (controllerId: string): GameLoopInput | undefined => {
    if (gameState !== "playing" || matchPhase !== "playing") {
      return undefined;
    }

    if (controllerId.startsWith("bot-")) {
      // It's a bot!
      const delta = 1 / 60;
      return botManager.getBotInput(controllerId, delta, timeRef.current);
    }

    // Get input from host (already validated, typed, and latched)
    const input = getInputFromHost(controllerId);

    if (!input) {
      return undefined;
    }

    // Input is fully typed! No manual type guards needed
    // Just ensure defaults for missing fields
    return {
      vector: input.vector ?? { x: 0, y: 0 },
      action: input.action ?? false,
      ability: input.ability ?? false,
      timestamp: input.timestamp ?? Date.now(),
    };
  };

  return { popInput };
};
