import { parseArgs } from "node:util";
import { runVisualCaptureCommand } from "./core.js";

const { values } = parseArgs({
  allowPositionals: false,
  options: {
    game: {
      type: "string",
    },
    scenario: {
      type: "string",
    },
    mode: {
      type: "string",
      default: "standalone-dev",
    },
    secure: {
      type: "boolean",
      default: false,
    },
  },
});

if (!values.game) {
  throw new Error("Missing required --game option.");
}
if (values.mode !== "standalone-dev") {
  throw new Error("Private Arcade capture belongs to the product repository.");
}

await runVisualCaptureCommand({
  gameId: values.game,
  scenarioId: values.scenario ?? null,
  mode: values.mode,
  secure: values.secure,
});
