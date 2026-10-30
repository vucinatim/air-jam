import * as module from "node:module";

const graph = new Set<string>();
let registered = false;
const withoutQuery = (url: string) => url.split("?")[0];

export function registerDeclarationHook(configUrl: string) {
  if (typeof module.registerHooks !== "function")
    throw new Error("Air Jam authoring requires Node.js 22.15 or newer.");
  graph.add(withoutQuery(configUrl));
  if (registered) return;
  module.registerHooks({
    resolve(specifier, context, nextResolve) {
      const inGraph =
        graph.has(withoutQuery(specifier)) ||
        (context.parentURL !== undefined &&
          graph.has(withoutQuery(context.parentURL)));
      if (
        inGraph &&
        (specifier === "@air-jam/sdk" ||
          /^(react|react-dom)(\/|$)/.test(specifier))
      )
        throw new Error(
          `AJ_DECLARATION_NOT_FRAMEWORK_FREE: ${context.parentURL ?? specifier} imports ${specifier}. Move browser bindings to app.tsx and import declarations from @air-jam/sdk/core.`,
        );
      const result = nextResolve(specifier, context);
      if (inGraph || graph.has(withoutQuery(result.url))) {
        if (/\.(tsx|css)(\?|$)/.test(result.url))
          throw new Error(
            `AJ_DECLARATION_NOT_FRAMEWORK_FREE: ${context.parentURL ?? specifier} imports ${result.url}. Keep the declaration graph framework-free.`,
          );
        graph.add(withoutQuery(result.url));
      }
      return result;
    },
    load(url, context, nextLoad) {
      return nextLoad(
        url,
        graph.has(withoutQuery(url)) && /\.ts(?:\?|$)/.test(url)
          ? { ...context, format: "module" }
          : context,
      );
    },
  });
  registered = true;
}
