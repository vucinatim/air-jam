import type { LoadHook, ResolveHook } from "node:module";

const graph = new Set<string>();
let root: string;
export function initialize(configUrl: string) {
  root = configUrl;
  graph.add(configUrl);
}
export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
  const inGraph =
    specifier.split("?")[0] === root ||
    (context.parentURL !== undefined && graph.has(context.parentURL));
  const forbidden = (value: string) =>
    value === "@air-jam/sdk" ||
    /^(react|react-dom)(\/|$)/.test(value) ||
    /\.(tsx|css)(\?|$)/.test(value);
  if (
    inGraph &&
    (specifier === "@air-jam/sdk" || /^(react|react-dom)(\/|$)/.test(specifier))
  )
    throw new Error(
      `AJ_DECLARATION_NOT_FRAMEWORK_FREE: ${context.parentURL ?? specifier} imports ${specifier}. Move browser bindings to app.tsx and import declarations from @air-jam/sdk/core.`,
    );
  const result = await nextResolve(specifier, context);
  if (inGraph || result.url.split("?")[0] === root) {
    if (forbidden(result.url))
      throw new Error(
        `AJ_DECLARATION_NOT_FRAMEWORK_FREE: ${context.parentURL ?? specifier} imports ${result.url}. Keep the declaration graph framework-free.`,
      );
    graph.add(result.url);
  }
  return result;
};

export const load: LoadHook = async (url, context, nextLoad) =>
  nextLoad(
    url,
    graph.has(url) && /\.ts(?:\?|$)/.test(url)
      ? { ...context, format: "module" }
      : context,
  );
