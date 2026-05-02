import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  format: ["esm"],
  target: "node20",
  sourcemap: false,
  clean: true,
  dts: false,
  splitting: false,
  treeshake: true,
  shims: false,
});
