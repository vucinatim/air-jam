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

await runVisualCaptureCommand({
  gameId: values.game,
  scenarioId: values.scenario ?? null,
  mode: values.mode as "standalone-dev" | "arcade-built",
  secure: values.secure,
});
