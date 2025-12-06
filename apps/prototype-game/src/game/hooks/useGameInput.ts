import { useAirJamInput, type GameLoopInput } from "@air-jam/sdk";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useBotManager } from "../bot-system/BotManager";

export const useGameInput = (options: { roomId?: string } = {}) => {
  const { popInput: popRealInput, clearInput: clearRealInput } =
    useAirJamInput(options);
  const botManager = useBotManager.getState();

  // We need time for bot updates
  const timeRef = useRef(0);

  useFrame((state) => {
    timeRef.current = state.clock.elapsedTime;
  });

  const popInput = (controllerId: string): GameLoopInput | undefined => {
    if (controllerId.startsWith("bot-")) {
      // It's a bot!
      // We need delta for bot update, but popInput signature doesn't provide it.
      // Ideally BotManager updates bots in a separate useFrame, but for now let's do it on demand or just use a fixed delta/time?
      // Actually, Ship.tsx calls popInput inside useFrame, so we are in the loop.
      // But we don't have delta here.
      // Let's rely on BotManager to just return the current calculated input.
      // Wait, BotController.update needs delta.
      // Let's assume 1/60 for now or fetch from Three.js clock if possible?
      // We can use the ref updated by useFrame above.

      // Actually, better design: BotManager should have its own useFrame to update all bots?
      // Or we just pass a rough delta here.
      const delta = 1 / 60;
      return botManager.getBotInput(controllerId, delta, timeRef.current);
    }

    return popRealInput(controllerId);
  };

  const clearInput = (controllerId: string) => {
    if (controllerId.startsWith("bot-")) {
      // Bot cleanup is handled by BotManager.removeBot usually
      return;
    }
    clearRealInput(controllerId);
  };

  return { popInput, clearInput };
};
