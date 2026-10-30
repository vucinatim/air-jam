import { loadAirJamGame, loadAirJamTesting } from "./load-game.js";
const inline = process.argv.find((value) => value.startsWith("--config="));
const configIndex = process.argv.indexOf("--config");
const configPath =
  inline?.slice(9) ??
  (configIndex >= 0 ? process.argv[configIndex + 1] : undefined);
if (!configPath) throw new Error("Missing required --config.");
const game = await loadAirJamGame(configPath);
const testing = await loadAirJamTesting(configPath, game);
process.stdout.write(
  `${JSON.stringify({
    hasVisualScenarios: Boolean(testing?.visual),
    gameId: game.metadata.slug,
    scenarios:
      testing?.visual?.scenarios.map((scenario) => ({
        scenarioId: scenario.id,
        description: scenario.description ?? null,
        supportedModes: ["standalone-dev", "arcade-test"],
      })) ?? [],
  })}\n`,
);
