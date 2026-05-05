import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  shims: true,
  platform: "node",
  noExternal: ["@air-jam/devtools-core"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
