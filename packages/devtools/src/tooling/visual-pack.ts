import { loadAirJamGame, loadAirJamTesting } from "./load-game.js";

export const loadVisualScenarioPackFromConfig = async (configPath: string) => {
  const game = await loadAirJamGame(configPath);
  const testing = await loadAirJamTesting(configPath, game);
  if (!game.agent || !testing?.visual)
    throw new Error(
      `Game "${game.metadata.slug}" must declare agent and testing.visual for visual scenarios.`,
    );
  return testing.visual;
};
