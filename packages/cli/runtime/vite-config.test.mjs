import assert from "node:assert/strict";
import test from "node:test";
import { sourceFencePlugin } from "./source-fence.mjs";
import {
  AIR_JAM_IFRAME_HEADERS,
  createAirJamViteConfig,
} from "./vite-config.mjs";

test("createAirJamViteConfig default profile keeps Air Jam dev contract minimal", () => {
  const config = createAirJamViteConfig({
    env: {},
    port: 5173,
  });

  assert.equal(config.server.host, true);
  assert.equal(config.base, "/");
  assert.equal(config.server.allowedHosts, true);
  assert.equal(config.server.port, 5173);
  assert.deepEqual(config.server.headers, AIR_JAM_IFRAME_HEADERS);
  assert.deepEqual(config.server.watch.ignored, ["**/.airjam/**"]);
  assert.equal(
    config.server.proxy["/socket.io"].target,
    "http://127.0.0.1:4000",
  );
  assert.equal(config.build.chunkSizeWarningLimit, 1000);
});

test("builds can use an isolated version directory without changing dev routing", () => {
  const config = createAirJamViteConfig({
    env: { AIR_JAM_BUILD_BASE: "/v/revision-1/" },
  });
  assert.equal(config.base, "/v/revision-1/");
  for (const base of [
    "https://other.test/",
    "//other.test/",
    "/../",
    "/v/?token=x",
  ])
    assert.throws(
      () => createAirJamViteConfig({ env: { AIR_JAM_BUILD_BASE: base } }),
      /absolute directory path/,
    );
});

test("createAirJamViteConfig three profile keeps core runtime buckets stable", () => {
  const config = createAirJamViteConfig({
    env: {},
    port: 5173,
    profile: "three",
  });

  const manualChunks = config.build?.rollupOptions?.output?.manualChunks;

  assert.equal(typeof manualChunks, "function");
  assert.equal(
    manualChunks("/workspace/node_modules/zod/v4/index.js"),
    "airjam-sdk",
  );
  assert.equal(
    manualChunks("/workspace/node_modules/react/index.js"),
    "app-runtime",
  );
  assert.equal(
    manualChunks("/workspace/node_modules/zustand/react.js"),
    "app-runtime",
  );
  assert.equal(
    manualChunks("/workspace/node_modules/@react-three/fiber/dist/index.js"),
    "fiber-runtime",
  );
});

test("createAirJamViteConfig rejects unknown profiles", () => {
  assert.throws(
    () => createAirJamViteConfig({ profile: "weird" }),
    /Unsupported Air Jam Vite profile/,
  );
});

test("source fence holds watcher updates and requests, reloads once, and ignores late events", async (context) => {
  const { EventEmitter } = await import("node:events");
  const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createHash } = await import("node:crypto");
  const root = await mkdtemp(join(tmpdir(), "airjam-fence-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, ".airjam/devtools"), { recursive: true });
  const marker = join(root, ".airjam/devtools/source-change.json");
  let tick;
  context.mock.method(globalThis, "setInterval", (callback) => {
    tick = callback;
    return { unref() {} };
  });
  context.mock.method(globalThis, "clearInterval", () => {});
  const watcher = new EventEmitter();
  const changed = [];
  watcher.on("change", (path) => changed.push(path));
  const sent = [];
  let invalidations = 0;
  let middleware;
  const plugin = sourceFencePlugin();
  plugin.configureServer({
    config: {
      root,
      configFileDependencies: [],
      envDir: root,
      mode: "development",
    },
    httpServer: watcher,
    watcher,
    environments: {
      client: {
        moduleGraph: {
          invalidateAll() {
            invalidations++;
          },
        },
      },
    },
    ws: {
      send(message) {
        sent.push(message);
      },
    },
    middlewares: {
      use(callback) {
        middleware = callback;
      },
    },
  });
  context.after(() => watcher.emit("close"));
  const setState = (state) => writeFile(marker, JSON.stringify(state));
  await setState({
    id: "one",
    phase: "applying",
    expiresAt: Date.now() + 60_000,
  });
  let served = false;
  middleware({}, {}, () => {
    served = true;
  });
  for (const path of ["render.ts", "host.ts"]) {
    await writeFile(join(root, path), "new");
    watcher.emit("change", join(root, path));
  }
  assert.equal(served, false);
  assert.deepEqual(changed, []);
  assert.deepEqual(sent, []);
  const files = ["render.ts", "host.ts"].map((path) => ({
    path,
    hash: createHash("sha256").update("new").digest("hex"),
  }));
  await setState({ id: "one", phase: "settled", committed: true, files });
  tick();
  watcher.emit("change", join(root, "render.ts"));
  watcher.emit("change", join(root, "host.ts"));
  tick();
  assert.equal(served, true);
  assert.deepEqual(sent, [{ type: "full-reload", path: "*" }]);
  assert.equal(invalidations, 1);
  assert.deepEqual(changed, []);
  await writeFile(join(root, "render.ts"), "next independent edit");
  watcher.emit("change", join(root, "render.ts"));
  assert.deepEqual(changed, [join(root, "render.ts")]);
  await setState({ id: "two", phase: "settled", committed: false, files: [] });
  tick();
  assert.equal(sent.length, 1);
  await setState({
    id: "crashed",
    phase: "applying",
    expiresAt: Date.now() - 1,
  });
  tick();
  assert.equal(sent.length, 2);
  await setState({
    id: "config",
    phase: "settled",
    committed: true,
    files: [{ path: ".env", hash: null }],
  });
  tick();
  assert.equal(sent.length, 2);
  assert.equal(changed.at(-1), join(root, ".env"));
});
