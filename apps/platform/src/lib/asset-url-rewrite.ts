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
}: {
  content: string;
  basePath: string;
}): string => {
  const relativeBasePath = basePath.replace(/^\/+/, "");

  return content
    .replaceAll(
      QUOTED_ASSET_URL_PATTERN,
      (_, prefix: string, assetPath: string) =>
        `${prefix}${basePath}/${assetPath}`,
    )
    .replaceAll(
      QUOTED_BARE_ASSET_URL_PATTERN,
      (_, prefix: string, assetPath: string) =>
        `${prefix}${relativeBasePath}/${assetPath}`,
    );
};
