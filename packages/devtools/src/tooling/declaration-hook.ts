import * as module from "node:module";

let activeLoads = 0;
let registered = false;
let pending: Promise<unknown> = Promise.resolve();

export function importDeclaration<T>(load: () => Promise<T>): Promise<T> {
  if (typeof module.registerHooks !== "function")
    throw new Error("Air Jam authoring requires Node.js 22.15 or newer.");
  if (!registered) {
    module.registerHooks({
      resolve(specifier, context, nextResolve) {
        if (
          activeLoads > 0 &&
          (specifier === "@air-jam/sdk" ||
            /^(react|react-dom)(\/|$)/.test(specifier))
        )
          throw new Error(
            `AJ_DECLARATION_NOT_FRAMEWORK_FREE: ${context.parentURL ?? specifier} imports ${specifier}. Move browser bindings to app.tsx and import declarations from @air-jam/sdk/core.`,
          );
        const result = nextResolve(specifier, context);
        if (activeLoads > 0 && /\.(tsx|css)(\?|$)/.test(result.url))
          throw new Error(
            `AJ_DECLARATION_NOT_FRAMEWORK_FREE: ${context.parentURL ?? specifier} imports ${result.url}. Keep the declaration framework-free.`,
          );
        return result;
      },
      load(url, context, nextLoad) {
        return nextLoad(
          url,
          activeLoads > 0 && /\.ts(?:\?|$)/.test(url)
            ? { ...context, format: "module" }
            : context,
        );
      },
    });
    registered = true;
  }
  const loaded = pending.then(async () => {
    activeLoads++;
    try {
      return await load();
    } finally {
      activeLoads--;
    }
  });
  pending = loaded.then(
    () => undefined,
    () => undefined,
  );
  return loaded;
}
