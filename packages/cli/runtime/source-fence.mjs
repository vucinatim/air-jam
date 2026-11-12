import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { publicAssetFallback } from "./public-assets.mjs";

function read(path) {
  try {
    return readFileSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

// Replay final watcher events for Vite's caches, but batch their browser delivery.
export function sourceFencePlugin() {
  const replay = new AsyncLocalStorage();
  return {
    name: "airjam-source-fence",
    apply: "serve",
    hotUpdate: {
      order: "post",
      handler() {
        // Public-file registration and module bookkeeping precede this hook.
        replay.getStore()?.resolve();
      },
    },
    configureServer(server) {
      const marker = resolve(
        server.config.root,
        ".airjam/devtools/source-change.json",
      );
      const watcher = server.watcher;
      const emit = watcher.emit;
      const expected = new Map();
      const queued = new Map();
      const waiting = new Set();
      const restore = [];
      let seen;
      let held = false;
      let settling = false;
      for (const channel of new Set([
        server.ws,
        ...Object.values(server.environments).map(
          (environment) => environment.hot,
        ),
      ])) {
        const send = channel.send;
        channel.send = function (message, ...argumentsList) {
          const context = replay.getStore();
          if (context) {
            if (message.type === "error")
              context.reject(new Error(message.err.message));
            if (
              ["update", "full-reload", "prune", "error"].includes(message.type)
            )
              return;
          }
          return send.call(this, message, ...argumentsList);
        };
        restore.push(() => {
          channel.send = send;
        });
      }
      function dispatch(event, argumentsList) {
        return new Promise((resolvePromise, reject) => {
          replay.run({ resolve: resolvePromise, reject }, () =>
            emit.call(watcher, event, ...argumentsList),
          );
        });
      }
      async function settle(state) {
        const events = new Map(queued);
        queued.clear();
        for (const file of state.files ?? []) {
          const path = resolve(server.config.root, file.path);
          expected.set(path, file.hash);
          // Explicit final events also cover OS notifications arriving after release.
          events.set(path, [file.event, [path]]);
        }
        if (state.phase !== "applying" && !state.committed) return;
        if (server.config.server.hmr === false) {
          await server.restart();
          return;
        }
        const configFiles = new Set([
          server.config.configFile,
          ...server.config.configFileDependencies,
          ...(server.config.envDir === false
            ? []
            : [
                ".env",
                ".env.local",
                `.env.${server.config.mode}`,
                `.env.${server.config.mode}.local`,
              ].map((name) => resolve(server.config.envDir, name))),
        ]);
        let changedConfig;
        const pending = [];
        for (const [path, [event, argumentsList]] of events) {
          if (configFiles.has(path)) changedConfig = path;
          else pending.push(dispatch(event, argumentsList));
        }
        await Promise.all(pending);
        if (changedConfig) {
          // Let Vite reload its own config once, including plugin and env caches.
          emit.call(watcher, "change", changedConfig);
        } else {
          for (const environment of Object.values(server.environments))
            environment.moduleGraph.invalidateAll();
          server.ws.send({ type: "full-reload", path: "*" });
        }
      }
      function reconcile() {
        const bytes = read(marker);
        const state = bytes && JSON.parse(bytes.toString());
        held = state?.phase === "applying" && state.expiresAt > Date.now();
        if (held || settling) return;
        if (state && state.id !== seen) {
          seen = state.id;
          settling = true;
          return settle(state)
            .catch((error) => {
              server.ws.send({
                type: "error",
                err: { message: error.message, stack: error.stack },
              });
            })
            .finally(() => {
              settling = false;
              reconcile();
            });
        }
        for (const next of waiting) next();
        waiting.clear();
      }
      // A settled marker from before this server started needs no reload.
      const initial = read(marker);
      if (initial) {
        const state = JSON.parse(initial.toString());
        if (state.phase === "settled") seen = state.id;
      }
      watcher.emit = function (event, ...argumentsList) {
        if (["change", "add", "unlink"].includes(event)) {
          reconcile();
          const path = resolve(argumentsList[0]);
          if (expected.has(path)) {
            const content = read(path);
            const hash =
              content === null
                ? null
                : createHash("sha256").update(content).digest("hex");
            if (hash === expected.get(path)) return false;
            expected.delete(path);
          }
          if (held) {
            queued.set(path, [event, argumentsList]);
            return false;
          }
        }
        return emit.call(this, event, ...argumentsList);
      };
      server.middlewares.use((_request, _response, next) => {
        reconcile();
        if (held || settling) waiting.add(next);
        else next();
      });
      const timer = setInterval(reconcile, 25);
      timer.unref();
      const cleanup = () => {
        clearInterval(timer);
        watcher.emit = emit;
        for (const reset of restore) reset();
        for (const next of waiting) next();
        waiting.clear();
      };
      server.httpServer?.once("close", cleanup);
      return () => server.middlewares.use(publicAssetFallback(server));
    },
  };
}
