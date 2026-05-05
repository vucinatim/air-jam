import { chmod, readFile, writeFile } from "node:fs/promises";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
    config: "src/config.ts",
    server: "src/server.ts",
    tools: "src/tools.ts",
    types: "src/types.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: "es2022",
  platform: "node",
  external: ["socket.io-client"],
  noExternal: ["@air-jam/devtools-core"],
  onSuccess: async () => {
    const cliPath = "dist/cli.js";
    const content = await readFile(cliPath, "utf8");
    if (!content.startsWith("#!/usr/bin/env node\n")) {
      await writeFile(cliPath, `#!/usr/bin/env node\n${content}`);
    }
    await chmod(cliPath, 0o755);
  },
});
