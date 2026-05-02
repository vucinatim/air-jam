import { parseArgs } from "node:util";
import { runVisualPrefabCaptureCommand } from "./prefab-core.js";

const { values } = parseArgs({
  allowPositionals: false,
  options: {
    game: {
      type: "string",
    },
    prefab: {
      type: "string",
    },
    variant: {
      type: "string",
      multiple: true,
      default: [],
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

if (!values.prefab) {
  throw new Error("Missing required --prefab option.");
}

await runVisualPrefabCaptureCommand({
  gameId: values.game,
  prefabId: values.prefab,
  variantPairs: values.variant,
  mode: values.mode as "standalone-dev" | "arcade-built",
  secure: values.secure,
});
