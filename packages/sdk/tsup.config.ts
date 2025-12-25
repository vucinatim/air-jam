import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/protocol.ts"],
  format: ["cjs", "esm"],
  dts: true, // Generate declaration files
  clean: true,
  sourcemap: true,
  external: ["react", "react-dom"],
  treeshake: true,
  // Don't bundle CSS - let consumers handle it via the exported styles.css
  loader: {
    ".css": "copy",
  },
});
