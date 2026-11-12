import { realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import sirv from "sirv";

function contains(directory, file) {
  const path = relative(directory, file);
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export function publicAssetFallback(server) {
  const { publicDir, base } = server.config;
  if (!publicDir) return (_request, _response, next) => next();
  const serve = sirv(publicDir, {
    dev: true,
    etag: true,
    extensions: [],
    setHeaders(response, path) {
      if (/\.(?:[tj]sx?|[cm][tj]s)$/.test(path))
        response.setHeader("Content-Type", "text/javascript");
      for (const [name, value] of Object.entries(
        server.config.server.headers ?? {},
      ))
        response.setHeader(name, value);
    },
  });
  return (request, response, next) => {
    if (!["GET", "HEAD"].includes(request.method)) return next();
    // Vite's HTML fallback rewrites url before configureServer's post hook.
    const original = request.originalUrl;
    if (!original?.startsWith(base)) return next();
    const url = `/${original.slice(base.length)}`;
    const [encodedPath, query] = url.split("?");
    const parameters = new URLSearchParams(query);
    if (["import", "raw", "url"].some((name) => parameters.has(name)))
      return next();
    let path;
    try {
      path = decodeURI(encodedPath);
    } catch {
      return next();
    }
    if (path.includes("\0")) return next();
    const file = resolve(publicDir, `.${path}`);
    if (!contains(publicDir, file)) return next();
    try {
      if (
        !contains(realpathSync(publicDir), realpathSync(file)) ||
        !statSync(file).isFile()
      )
        return next();
    } catch (error) {
      if (["ENOENT", "ENOTDIR"].includes(error.code)) return next();
      return next(error);
    }
    const previous = request.url;
    request.url = url;
    serve(request, response, (error) => {
      request.url = previous;
      next(error);
    });
  };
}
