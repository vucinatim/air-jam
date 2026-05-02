import { chmod, readFile, writeFile } from "node:fs/promises";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  onSuccess: async () => {
    const cliPath = "dist/cli.js";
    const content = await readFile(cliPath, "utf8");
    if (!content.startsWith("#!/usr/bin/env node\n")) {
      await writeFile(cliPath, `#!/usr/bin/env node\n${content}`);
    }
    await chmod(cliPath, 0o755);
  },
});
