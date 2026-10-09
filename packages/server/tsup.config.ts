import { chmod, readFile, writeFile } from "node:fs/promises";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    index: "src/index.ts",
  },
  format: ["esm"],
  dts: { entry: "src/index.ts", compilerOptions: { composite: false } },
  clean: true,
  sourcemap: true,
  platform: "node",
  noExternal: ["@air-jam/devtools-core", "@air-jam/env", "@air-jam/harness"],
  // Add shebang only to CLI file after build
  onSuccess: async () => {
    const cliPath = "dist/cli.js";
    const content = await readFile(cliPath, "utf-8");
    if (!content.startsWith("#!/usr/bin/env node\n")) {
      await writeFile(cliPath, `#!/usr/bin/env node\n${content}`);
    }
    await chmod(cliPath, 0o755);
  },
});
