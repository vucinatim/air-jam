import { useAirJamInput } from "@air-jam/sdk";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useBotManager } from "../bot-system/BotManager";
import { gameInputSchema, GameLoopInput } from "../types";

export const useGameInput = () => {
  // Type-safe input handle
  const { getController, clearInput: clearHandleState } = useAirJamInput<GameLoopInput>({
    schema: gameInputSchema,
  });

  const botManager = useBotManager.getState();

  // We need time for bot updates
  const timeRef = useRef(0);

  useFrame((state) => {
    timeRef.current = state.clock.elapsedTime;
  });

  const popInput = (controllerId: string) => {
    if (controllerId.startsWith("bot-")) {
      // It's a bot!
      const delta = 1 / 60;
      return botManager.getBotInput(controllerId, delta, timeRef.current);
    }

    // Get the intelligent controller handle
    const controller = getController(controllerId);
    if (!controller) return undefined;

    return {
      vector: controller.vector("vector"),
      action: controller.justPressed("action"),
      ability: controller.justPressed("ability"),
      timestamp: controller.raw.timestamp ?? Date.now(),
    };
  };

  const clearInput = (controllerId: string) => {
    if (controllerId.startsWith("bot-")) return;
    clearHandleState(controllerId);
  };

  return { popInput, clearInput };
};
