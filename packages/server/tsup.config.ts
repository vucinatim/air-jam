import { defineConfig } from "tsup";
import { chmod, readFile, writeFile } from "node:fs/promises";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  format: ["esm"],
  dts: false, // Server is a CLI tool, not a library
  clean: true,
  sourcemap: true,
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

