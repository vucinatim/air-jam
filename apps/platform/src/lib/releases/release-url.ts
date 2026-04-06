import { rewriteRootRelativeAssetUrlsInText } from "@/lib/asset-url-rewrite";

export const RELEASES_PATH_PREFIX = "/releases";

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, "");

export const buildHostedReleaseAssetPath = ({
  gameId,
  releaseId,
  assetPath,
}: {
  gameId: string;
  releaseId: string;
  assetPath: string;
}): string =>
  `${RELEASES_PATH_PREFIX}/g/${trimSlashes(gameId)}/r/${trimSlashes(
    releaseId,
  )}/${trimSlashes(assetPath)}`;

export const buildHostedReleaseBasePath = ({
  gameId,
  releaseId,
}: {
  gameId: string;
  releaseId: string;
}): string =>
  `${RELEASES_PATH_PREFIX}/g/${trimSlashes(gameId)}/r/${trimSlashes(releaseId)}`;

export const rewriteHostedReleaseHtmlAssetUrls = ({
  html,
  gameId,
  releaseId,
}: {
  html: string;
  gameId: string;
  releaseId: string;
}): string => {
  const hostedBasePath = buildHostedReleaseBasePath({
    gameId,
    releaseId,
  });

  return html
    .replaceAll(/((?:src|href)=["'])\/(?!\/)/g, `$1${hostedBasePath}/`)
    .replaceAll(/(url\(["']?)\/(?!\/)/g, `$1${hostedBasePath}/`);
};

export const rewriteHostedReleaseTextAssetUrls = ({
  content,
  gameId,
  releaseId,
}: {
  content: string;
  gameId: string;
  releaseId: string;
}): string => {
  const hostedBasePath = buildHostedReleaseBasePath({
    gameId,
    releaseId,
  });

  return rewriteRootRelativeAssetUrlsInText({
    content,
    basePath: hostedBasePath,
  });
};

export const logicalHostedReleaseRoutePath = ({
  requestedAssetPath,
  entryPath,
}: {
  requestedAssetPath: string;
  entryPath: string;
}): string => {
  if (requestedAssetPath === entryPath) {
    return "/";
  }

  return `/${trimSlashes(requestedAssetPath)}`;
};

export const injectHostedReleaseHtmlRuntimeBase = ({
  html,
  gameId,
  releaseId,
  requestedAssetPath,
  entryPath,
}: {
  html: string;
  gameId: string;
  releaseId: string;
  requestedAssetPath: string;
  entryPath: string;
}): string => {
  const hostedBasePath = buildHostedReleaseBasePath({
    gameId,
    releaseId,
  });
  const logicalPath = logicalHostedReleaseRoutePath({
    requestedAssetPath,
    entryPath,
  });
  const normalizedBaseHref = `${hostedBasePath}/`;
  const bootstrapScript = `<script>window.__AIRJAM_HOSTED_RELEASE_BASE__=${JSON.stringify(hostedBasePath)};window.__AIRJAM_HOSTED_RELEASE_ROUTE__=${JSON.stringify(logicalPath)};(function(){var targetPath=window.__AIRJAM_HOSTED_RELEASE_ROUTE__||"/";var targetUrl=targetPath+window.location.search+window.location.hash;if(window.location.pathname!==targetPath){window.history.replaceState(window.history.state,"",targetUrl);}})();</script>`;

  const withBaseTag = html.includes("<base ")
    ? html.replace(/<base\s+href=["'][^"']*["']\s*\/?>/i, `<base href="${normalizedBaseHref}">`)
    : html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}<base href="${normalizedBaseHref}">`);

  if (withBaseTag.includes("</head>")) {
    return withBaseTag.replace("</head>", `${bootstrapScript}</head>`);
  }

  return `${bootstrapScript}${withBaseTag}`;
};

export const normalizeRequestedReleaseAssetPath = (
  assetPathSegments: string[] | undefined,
  fallbackAssetPath: string,
): string => {
  const joinedPath = assetPathSegments?.join("/").trim() || fallbackAssetPath;
  const normalizedPath = joinedPath
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");

  if (
    !normalizedPath ||
    normalizedPath === "." ||
    normalizedPath.includes("\0") ||
    normalizedPath.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("Invalid release asset path.");
  }

  return normalizedPath;
};
