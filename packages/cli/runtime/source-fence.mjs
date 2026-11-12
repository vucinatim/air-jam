import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(path) {
  try {
    return readFileSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

// Gate watcher dispatch, before Vite invalidates modules or restarts for config
// changes. HMR hooks alone run too late and cannot suppress HTML reloads.
export function sourceFencePlugin() {
  return {
    name: "airjam-source-fence",
    apply: "serve",
    configureServer(server) {
      const marker = resolve(
        server.config.root,
        ".airjam/devtools/source-change.json",
      );
      const watcher = server.watcher;
      const emit = watcher.emit;
      const expected = new Map();
      const waiting = new Set();
      let seen;
      let held = false;
      function reconcile() {
        const bytes = read(marker);
        const state = bytes && JSON.parse(bytes.toString());
        held = state?.phase === "applying" && state.expiresAt > Date.now();
        if (held) return;
        if (state && state.id !== seen) {
          seen = state.id;
          for (const file of state.files ?? [])
            expected.set(resolve(server.config.root, file.path), file.hash);
          if (state.phase === "applying" || state.committed) {
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
            const changedConfig = (state.files ?? []).find((file) =>
              configFiles.has(resolve(server.config.root, file.path)),
            );
            if (changedConfig) {
              // Let Vite reload its own config, including plugin and env caches.
              emit.call(
                watcher,
                "change",
                resolve(server.config.root, changedConfig.path),
              );
            } else {
              for (const environment of Object.values(server.environments))
                environment.moduleGraph.invalidateAll();
              server.ws.send({ type: "full-reload", path: "*" });
            }
          }
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
          if (held) return false;
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
        }
        return emit.call(this, event, ...argumentsList);
      };
      server.middlewares.use((_request, _response, next) => {
        reconcile();
        if (held) waiting.add(next);
        else next();
      });
      const timer = setInterval(reconcile, 25);
      timer.unref();
      const cleanup = () => {
        clearInterval(timer);
        watcher.emit = emit;
        for (const next of waiting) next();
        waiting.clear();
      };
      server.httpServer?.once("close", cleanup);
    },
  };
}
