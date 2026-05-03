const REWRITABLE_ASSET_EXTENSIONS =
  "avif|bin|basis|css|csv|data|fbx|gif|glb|gltf|hdr|ico|jpe?g|js|json|ktx2|m4a|map|mp3|mp4|obj|ogg|pdf|png|svg|txt|usdz|wav|wasm|weba|webm|webp|woff2?";

const QUOTED_ASSET_URL_PATTERN = new RegExp(
  `(["'\\\`(])\\/(?!\\/)([^"'\\\`)]+\\.(?:${REWRITABLE_ASSET_EXTENSIONS})(?:\\?[^"'\\\`)]+)?)`,
  "g",
);

const QUOTED_BARE_ASSET_URL_PATTERN = new RegExp(
  `(["'\\\`(])(?![./#])((?:[A-Za-z0-9_-]+\\/)+[^"'\\\`)]+\\.(?:${REWRITABLE_ASSET_EXTENSIONS})(?:\\?[^"'\\\`)]+)?)`,
  "g",
);

export const rewriteRootRelativeAssetUrlsInText = ({
  content,
  basePath,
  rewriteBareRelativeAssetUrls = true,
}: {
  content: string;
  basePath: string;
  rewriteBareRelativeAssetUrls?: boolean;
}): string => {
  const relativeBasePath = basePath.replace(/^\/+/, "");

  const rewrittenRootRelativeUrls = content.replaceAll(
    QUOTED_ASSET_URL_PATTERN,
    (_, prefix: string, assetPath: string) =>
      `${prefix}${basePath}/${assetPath}`,
  );

  if (!rewriteBareRelativeAssetUrls) {
    return rewrittenRootRelativeUrls;
  }

  return rewrittenRootRelativeUrls.replaceAll(
    QUOTED_BARE_ASSET_URL_PATTERN,
    (_, prefix: string, assetPath: string) =>
      `${prefix}${relativeBasePath}/${assetPath}`,
  );
};
