import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/visual.ts",
    "src/runtime.ts",
    "src/core/dev-control.ts",
  ],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["@playwright/test", "react"],
});
