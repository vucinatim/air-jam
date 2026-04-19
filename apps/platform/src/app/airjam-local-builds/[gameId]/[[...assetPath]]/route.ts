import {
  injectLocalBuildHtmlRuntimeBase,
  isLocalBuildSpaFallbackPath,
  LOCAL_BUILD_ENTRY_PATH,
  normalizeRequestedLocalBuildAssetPath,
  rewriteLocalBuildHtmlAssetUrls,
  rewriteLocalBuildTextAssetUrls,
} from "@/lib/local-build-url";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wav": "audio/wav",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const getContentType = (filePath: string): string =>
  CONTENT_TYPE_BY_EXTENSION[path.extname(filePath).toLowerCase()] ??
  "application/octet-stream";

const readFileIfExists = async (filePath: string): Promise<Buffer | null> => {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return null;
    }

    return await fs.readFile(filePath);
  } catch {
    return null;
  }
};

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      gameId: string;
      assetPath?: string[];
    }>;
  },
) {
  const { gameId, assetPath } = await context.params;
  const activeGameId = process.env.AIR_JAM_LOCAL_BUILD_ACTIVE_GAME_ID?.trim();
  const activeDistDir = process.env.AIR_JAM_LOCAL_BUILD_ACTIVE_DIST_DIR?.trim();

  if (
    process.env.NODE_ENV === "production" ||
    !activeGameId ||
    !activeDistDir ||
    gameId !== activeGameId
  ) {
    return new Response("Not found", { status: 404 });
  }

  let resolvedAssetPath: string;
  try {
    resolvedAssetPath = normalizeRequestedLocalBuildAssetPath(assetPath);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  let servedAssetPath = resolvedAssetPath;
  let body = await readFileIfExists(path.join(activeDistDir, servedAssetPath));

  if (!body && isLocalBuildSpaFallbackPath(resolvedAssetPath)) {
    servedAssetPath = LOCAL_BUILD_ENTRY_PATH;
    body = await readFileIfExists(path.join(activeDistDir, servedAssetPath));
  }

  if (!body) {
    return new Response("Not found", { status: 404 });
  }

  const contentType = getContentType(servedAssetPath);
  const isHtmlDocument =
    contentType.includes("text/html") &&
    servedAssetPath === LOCAL_BUILD_ENTRY_PATH;
  const isRewritableTextAsset =
    contentType.includes("text/javascript") || contentType.includes("text/css");

  if (isHtmlDocument) {
    const htmlWithScopedAssets = rewriteLocalBuildHtmlAssetUrls({
      html: body.toString("utf8"),
      gameId,
    });
    const html = injectLocalBuildHtmlRuntimeBase({
      html: htmlWithScopedAssets,
      gameId,
    });

    return new Response(html, {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-type": contentType,
      },
    });
  }

  if (isRewritableTextAsset) {
    const rewritten = rewriteLocalBuildTextAssetUrls({
      content: body.toString("utf8"),
      gameId,
    });

    return new Response(rewritten, {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-type": contentType,
      },
    });
  }

  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": contentType,
  });

  if (request.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers,
    });
  }

  return new Response(new Uint8Array(body), {
    status: 200,
    headers,
  });
}

export const HEAD = GET;
