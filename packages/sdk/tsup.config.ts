import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "tsup";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
) as { version: string };

export default defineConfig((options) => ({
  entry: [
    "src/index.ts",
    "src/arcade.ts",
    "src/arcade/bridge.ts",
    "src/arcade/bridge/controller.ts",
    "src/arcade/bridge/host.ts",
    "src/arcade/bridge/iframe.ts",
    "src/arcade/host.ts",
    "src/arcade/runtime.ts",
    "src/arcade/surface.ts",
    "src/arcade/url.ts",
    "src/ui.ts",
    "src/protocol.ts",
    "src/metadata.ts",
    "src/prefabs.ts",
    "src/release.ts",
    "src/platform-machine.ts",
    "src/preview.ts",
    "src/agent-tooling.ts",
    "src/runtime-topology.ts",
    "src/runtime-inspection.ts",
    "src/runtime-control.ts",
  ],
  format: ["cjs", "esm"],
  dts: true, // Generate declaration files
  clean: !options.watch,
  sourcemap: true,
  external: ["react", "react-dom"],
  // Workspace consumers must not import a partially written bundle generation.
  // tsup calls this only after both JavaScript formats finish successfully.
  onSuccess: async () => {
    console.log("AIR_JAM_SDK_BUILD_READY");
  },
  define: {
    __AIR_JAM_SDK_VERSION__: JSON.stringify(packageJson.version),
  },
  // Don't bundle CSS - let consumers handle it via the exported styles.css
  loader: {
    ".css": "copy",
  },
}));
