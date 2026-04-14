import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "tsup";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
) as { version: string };

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/arcade.ts",
    "src/arcade/bridge.ts",
    "src/arcade/bridge/controller.ts",
    "src/arcade/bridge/host.ts",
    "src/arcade/bridge/iframe.ts",
    "src/arcade/host.ts",
    "src/arcade/surface.ts",
    "src/arcade/url.ts",
    "src/ui.ts",
    "src/protocol.ts",
    "src/runtime-control.ts",
    "src/runtime-inspection.ts",
    "src/runtime-observability.ts",
    "src/capabilities.ts",
    "src/prefabs.ts",
    "src/preview.ts",
    "src/contracts/v2/index.ts",
  ],
  format: ["cjs", "esm"],
  dts: true, // Generate declaration files
  clean: true,
  sourcemap: true,
  external: ["react", "react-dom"],
  treeshake: true,
  define: {
    __AIR_JAM_SDK_VERSION__: JSON.stringify(packageJson.version),
  },
  // Don't bundle CSS - let consumers handle it via the exported styles.css
  loader: {
    ".css": "copy",
  },
});
