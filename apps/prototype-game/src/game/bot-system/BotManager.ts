import { create } from "zustand";
import type { GameLoopInput } from "@air-jam/sdk";
import { BotController } from "./BotController";
import { useGameStore } from "../game-store";
import { nanoid } from "nanoid";

interface BotManagerState {
  bots: Map<string, BotController>;
  addBot: () => void;
  getBotInput: (controllerId: string, delta: number, time: number) => GameLoopInput | undefined;
  removeBot: (controllerId: string) => void;
}

export const useBotManager = create<BotManagerState>((set, get) => ({
  bots: new Map(),
  
  addBot: () => {
    const controllerId = `bot-${nanoid(6)}`;
    const bot = new BotController(controllerId);
    
    set((state) => {
      const newBots = new Map(state.bots);
      newBots.set(controllerId, bot);
      return { bots: newBots };
    });

    // Add to GameStore as a player
    useGameStore.getState().upsertPlayer(
      {
        id: controllerId,
        label: `Bot ${controllerId.slice(4)}`,
        // Bots don't have avatars yet, maybe use a default or random one if needed
        // For now, the profile just needs a label
      },
      controllerId
    );
    
    console.log(`[BotManager] Added bot: ${controllerId}`);
  },

  getBotInput: (controllerId, delta, time) => {
    const bot = get().bots.get(controllerId);
    if (!bot) return undefined;
    return bot.update(delta, time);
  },

  removeBot: (controllerId) => {
    set((state) => {
      const newBots = new Map(state.bots);
      newBots.delete(controllerId);
      return { bots: newBots };
    });
    useGameStore.getState().removePlayer(controllerId);
  },
}));
