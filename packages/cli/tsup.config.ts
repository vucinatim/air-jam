import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/scaffold.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  shims: true,
  sourcemap: true,
  platform: "node",
  target: "es2022",
  noExternal: ["@air-jam/devtools-core", "@air-jam/env"],
});
