import {
  airJamGameDescriptionSchema,
  describeAirJamGame,
} from "@air-jam/sdk/core";
import { stat } from "node:fs/promises";
import path from "node:path";
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
for (const config of configs) {
  const description = airJamGameDescriptionSchema.parse(
    describeAirJamGame(await loadAirJamGame(config)),
  );
  const publicDirectory = path.resolve(path.dirname(config), "../public");
  for (const [kind, assets] of Object.entries(description.assets)) {
    for (const [id, asset] of Object.entries(assets)) {
      const sources = Array.isArray(asset.src) ? asset.src : [asset.src];
      for (const source of sources) {
        const file = path.join(publicDirectory, source);
        const exists = await stat(file).then(
          (status) => status.isFile(),
          (error) => {
            if (error.code === "ENOENT" || error.code === "ENOTDIR")
              return false;
            throw error;
          },
        );
        if (!exists)
          throw new Error(
            `AJ_ASSET_MISSING: ${description.metadata.slug} ${kind}.${id} declares ${source}, missing from ${publicDirectory}.`,
          );
      }
    }
  }
  descriptions.push(description);
}
process.stdout.write(`${JSON.stringify(descriptions)}\n`);
