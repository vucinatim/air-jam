import { rewriteRootRelativeAssetUrlsInText } from "@/lib/asset-url-rewrite";
import path from "node:path";

export const LOCAL_BUILD_PATH_PREFIX = "/airjam-local-builds";
export const LOCAL_BUILD_ENTRY_PATH = "index.html" as const;

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, "");

export const buildLocalBuildBasePath = (gameId: string): string =>
  `${LOCAL_BUILD_PATH_PREFIX}/${trimSlashes(gameId)}`;

export const rewriteLocalBuildHtmlAssetUrls = ({
  html,
  gameId,
}: {
  html: string;
  gameId: string;
}): string => {
  const basePath = buildLocalBuildBasePath(gameId);

  return html
    .replaceAll(/((?:src|href)=["'])\/(?!\/)/g, `$1${basePath}/`)
    .replaceAll(/(url\(["']?)\/(?!\/)/g, `$1${basePath}/`);
};

export const rewriteLocalBuildTextAssetUrls = ({
  content,
  gameId,
}: {
  content: string;
  gameId: string;
}): string => {
  const basePath = buildLocalBuildBasePath(gameId);
  return rewriteRootRelativeAssetUrlsInText({
    content,
    basePath,
  });
};

export const injectLocalBuildHtmlRuntimeBase = ({
  html,
  gameId,
}: {
  html: string;
  gameId: string;
}): string => {
  const basePath = buildLocalBuildBasePath(gameId);
  const normalizedBaseHref = `${basePath}/`;
  const bootstrapScript = `<script>window.__AIRJAM_LOCAL_GAME_PROXY_BASE__=${JSON.stringify(basePath)};</script>`;

  const withBaseTag = html.includes("<base ")
    ? html.replace(
        /<base\s+href=["'][^"']*["']\s*\/?>/i,
        `<base href="${normalizedBaseHref}">`,
      )
    : html.replace(
        /<head(\s[^>]*)?>/i,
        (match) => `${match}<base href="${normalizedBaseHref}">`,
      );

  if (withBaseTag.includes("</head>")) {
    return withBaseTag.replace("</head>", `${bootstrapScript}</head>`);
  }

  return `${bootstrapScript}${withBaseTag}`;
};

export const normalizeRequestedLocalBuildAssetPath = (
  assetPathSegments: string[] | undefined,
): string => {
  const joinedPath =
    assetPathSegments?.join("/").trim() || LOCAL_BUILD_ENTRY_PATH;
  const normalizedPath = joinedPath
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");

  if (
    !normalizedPath ||
    normalizedPath === "." ||
    normalizedPath.includes("\0") ||
    normalizedPath
      .split("/")
      .some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("Invalid local build asset path.");
  }

  return normalizedPath;
};

export const isLocalBuildSpaFallbackPath = (relativePath: string): boolean => {
  const normalizedPath = relativePath
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .trim();

  if (!normalizedPath) {
    return false;
  }

  return !path.posix.extname(normalizedPath);
};
