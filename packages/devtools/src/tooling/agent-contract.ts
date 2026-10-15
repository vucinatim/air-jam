import { createAirJamAgentEvaluator } from "@air-jam/sdk/agent-tooling";
import { loadAirJamAppConfig } from "./airjam-agent.js";

const index = process.argv.indexOf("--config");
const configPath = process.argv[index + 1];
if (index === -1 || !configPath)
  throw new Error("Source inspection requires --config.");
const app = await loadAirJamAppConfig(configPath);
const result = app.agent
  ? { hasContract: true, ...createAirJamAgentEvaluator(app.agent).describe() }
  : { hasContract: false };
process.stdout.write(`${JSON.stringify(result)}\n`);
