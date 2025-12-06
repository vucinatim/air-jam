import { useAirJamInput, useAirJamInputLatch } from "@air-jam/sdk";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useBotManager } from "../bot-system/BotManager";
import { gameInputSchema, GameLoopInput } from "../types";

export const useGameInput = (options: { roomId?: string } = {}) => {
  // Type-safe input with Zod schema validation
  const { popInput: popRawInput, clearInput: clearRawInput } = useAirJamInput({
    ...options,
    schema: gameInputSchema,
  });

  // Type-safe latching with inferred types
  const { getLatched, clearState: clearLatchState } =
    useAirJamInputLatch<GameLoopInput>({
      booleanFields: ["action", "ability"],
      vectorFields: ["vector"],
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

    // Get raw input (already validated and typed by useAirJamInput)
    const rawInput = popRawInput(controllerId);

    // Apply latching for this game's input pattern
    // getLatched preserves the type and handles undefined
    const latchedInput = getLatched(controllerId, rawInput);

    if (!latchedInput) {
      return undefined;
    }

    // Input is fully typed! No manual type guards needed
    // Just ensure defaults for missing fields
    return {
      vector: latchedInput.vector ?? { x: 0, y: 0 },
      action: latchedInput.action ?? false,
      ability: latchedInput.ability ?? false,
      timestamp: latchedInput.timestamp ?? Date.now(),
    };
  };

  const clearInput = (controllerId: string) => {
    if (controllerId.startsWith("bot-")) {
      // Bot cleanup is handled by BotManager.removeBot usually
      return;
    }
    clearRawInput(controllerId);
    clearLatchState(controllerId);
  };

  return { popInput, clearInput };
};
