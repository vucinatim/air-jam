import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sourceFencePlugin } from "./source-fence.mjs";

// Resolve the game's Vite, keeping it an app dependency rather than a CLI copy.
const require = createRequire(resolve("package.json"));
const { createServer } = await import(
  pathToFileURL(require.resolve("vite")).href
);
const server = await createServer({ plugins: [sourceFencePlugin()] });
await server.listen();
server.printUrls();
server.bindCLIShortcuts({ print: true });
