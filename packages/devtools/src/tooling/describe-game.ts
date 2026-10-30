import {
  airJamGameDescriptionSchema,
  describeAirJamGame,
} from "@air-jam/sdk/core";
import { loadAirJamGame } from "./load-game.js";

const configs: string[] = [];
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index];
  if (argument === "--config") {
    const value = process.argv[++index];
    if (!value) throw new Error("--config requires a path.");
    configs.push(value);
  } else if (argument.startsWith("--config=")) configs.push(argument.slice(9));
  else throw new Error(`Unknown describe-game argument: ${argument}`);
}
if (!configs.length)
  throw new Error("describe-game requires at least one --config path.");
const descriptions = [];
for (const config of configs)
  descriptions.push(
    airJamGameDescriptionSchema.parse(
      describeAirJamGame(await loadAirJamGame(config)),
    ),
  );
process.stdout.write(`${JSON.stringify(descriptions)}\n`);
