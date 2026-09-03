import { rewriteRootRelativeAssetUrlsInText } from "@/lib/asset-url-rewrite";
import { HOSTED_RELEASE_CONTROLLER_PATH } from "@air-jam/sdk/release";
import {
  AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY,
  resolveRuntimeTopology,
  serializeRuntimeTopology,
} from "@air-jam/sdk/runtime-topology";

export const RELEASES_PATH_PREFIX = "/releases";

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, "");

export const buildHostedReleaseBasePath = ({
  gameId,
  releaseId,
  generationId,
}: {
  gameId: string;
  releaseId: string;
  generationId: string;
}): string =>
  `${RELEASES_PATH_PREFIX}/g/${trimSlashes(gameId)}/r/${trimSlashes(releaseId)}/generations/${trimSlashes(generationId)}`;

export const buildHostedReleaseAssetPath = ({
  gameId,
  releaseId,
  generationId,
  assetPath,
}: {
  gameId: string;
  releaseId: string;
  generationId: string;
  assetPath: string;
}): string => {
  const basePath = buildHostedReleaseBasePath({
    gameId,
    releaseId,
    generationId,
  });
  const normalizedAssetPath = trimSlashes(assetPath);

  return normalizedAssetPath ? `${basePath}/${normalizedAssetPath}` : basePath;
};

export const rewriteHostedReleaseHtmlAssetUrls = ({
  html,
  gameId,
  releaseId,
  generationId,
}: {
  html: string;
  gameId: string;
  releaseId: string;
  generationId: string;
}): string => {
  const hostedBasePath = buildHostedReleaseBasePath({
    gameId,
    releaseId,
    generationId,
  });

  return html
    .replaceAll(/((?:src|href)=["'])\/(?!\/)/g, `$1${hostedBasePath}/`)
    .replaceAll(/(url\(["']?)\/(?!\/)/g, `$1${hostedBasePath}/`);
};

export const rewriteHostedReleaseTextAssetUrls = ({
  content,
  gameId,
  releaseId,
  generationId,
  contentType,
}: {
  content: string;
  gameId: string;
  releaseId: string;
  generationId: string;
  contentType?: string;
}): string => {
  const hostedBasePath = buildHostedReleaseBasePath({
    gameId,
    releaseId,
    generationId,
  });
  const normalizedContentType = contentType?.toLowerCase() ?? "";
  const rewriteBareRelativeAssetUrls =
    !normalizedContentType.includes("text/css");

  return rewriteRootRelativeAssetUrlsInText({
    content,
    basePath: hostedBasePath,
    rewriteBareRelativeAssetUrls,
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

export const buildHostedReleaseRuntimeTopology = ({
  gameId,
  releaseId,
  generationId,
  requestedAssetPath,
  entryPath,
  appOrigin,
  backendOrigin,
}: {
  gameId: string;
  releaseId: string;
  generationId: string;
  requestedAssetPath: string;
  entryPath: string;
  appOrigin: string;
  backendOrigin: string;
}): string => {
  const logicalPath = logicalHostedReleaseRoutePath({
    requestedAssetPath,
    entryPath,
  });
  const hostedBasePath = buildHostedReleaseBasePath({
    gameId,
    releaseId,
    generationId,
  });

  return serializeRuntimeTopology(
    resolveRuntimeTopology({
      runtimeMode: "hosted-release",
      surfaceRole:
        logicalPath === HOSTED_RELEASE_CONTROLLER_PATH ||
        logicalPath.startsWith(`${HOSTED_RELEASE_CONTROLLER_PATH}/`)
          ? "controller"
          : "host",
      appOrigin,
      backendOrigin,
      publicHost: appOrigin,
      assetBasePath: hostedBasePath,
      secureTransport: appOrigin.startsWith("https://"),
      proxyStrategy: "none",
    }),
  );
};

export const injectHostedReleaseHtmlRuntimeBase = ({
  html,
  gameId,
  releaseId,
  generationId,
  requestedAssetPath,
  entryPath,
  runtimeTopology,
}: {
  html: string;
  gameId: string;
  releaseId: string;
  generationId: string;
  requestedAssetPath: string;
  entryPath: string;
  runtimeTopology?: string;
}): string => {
  const hostedBasePath = buildHostedReleaseBasePath({
    gameId,
    releaseId,
    generationId,
  });
  const logicalPath = logicalHostedReleaseRoutePath({
    requestedAssetPath,
    entryPath,
  });
  const normalizedBaseHref = `${hostedBasePath}/`;
  const bootstrapScript = `<script>window.__AIRJAM_HOSTED_RELEASE_BASE__=${JSON.stringify(hostedBasePath)};window.__AIRJAM_HOSTED_RELEASE_ROUTE__=${JSON.stringify(logicalPath)};${runtimeTopology ? `window[${JSON.stringify(AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY)}]=${runtimeTopology};` : ""}(function(){var targetPath=window.__AIRJAM_HOSTED_RELEASE_ROUTE__||"/";var targetUrl=targetPath+window.location.search+window.location.hash;if(window.location.pathname!==targetPath){window.history.replaceState(window.history.state,"",targetUrl);}})();</script>`;

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
    normalizedPath
      .split("/")
      .some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("Invalid release asset path.");
  }

  return normalizedPath;
};
