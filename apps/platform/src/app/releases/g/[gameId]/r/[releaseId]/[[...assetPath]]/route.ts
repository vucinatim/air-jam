import { isHostedReleaseSpaFallbackPath } from "@/lib/releases/hosted-release-artifact";
import {
  injectHostedReleaseHtmlRuntimeBase,
  normalizeRequestedReleaseAssetPath,
  rewriteHostedReleaseHtmlAssetUrls,
  rewriteHostedReleaseTextAssetUrls,
} from "@/lib/releases/release-url";
import { getReleaseAssetCacheControl } from "@/server/releases/release-artifact-validation";
import {
  RELEASE_INSPECTION_ACCESS_HEADER,
  verifyReleaseInspectionAccessToken,
} from "@/server/releases/release-inspection-access";
import { getReleaseStorage } from "@/server/releases/release-storage";
import { buildReleaseSiteObjectKey } from "@/server/releases/release-storage-keys";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      gameId: string;
      releaseId: string;
      assetPath?: string[];
    }>;
  },
) {
  const { gameId, releaseId, assetPath } = await context.params;
  const configuredInternalSecret =
    process.env.AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN?.trim() || null;
  const internalAccessToken =
    request.headers.get(RELEASE_INSPECTION_ACCESS_HEADER)?.trim() || null;

  const release = await db.query.gameReleases.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.id, releaseId),
        eq(table.gameId, gameId),
      ),
  });

  if (!release) {
    return new Response("Not found", { status: 404 });
  }

  const canInspectPrivately =
    verifyReleaseInspectionAccessToken({
      token: internalAccessToken,
      gameId,
      releaseId,
      secret: configuredInternalSecret,
    }) &&
    ["checking", "ready", "quarantined", "live"].includes(release.status);

  if (release.status !== "live" && !canInspectPrivately) {
    return new Response("Not found", { status: 404 });
  }

  const game = await db.query.games.findFirst({
    where: (table, { and, eq }) =>
      canInspectPrivately
        ? eq(table.id, gameId)
        : and(eq(table.id, gameId), eq(table.arcadeVisibility, "listed")),
  });

  if (!game) {
    return new Response("Not found", { status: 404 });
  }

  const artifact = await db.query.gameReleaseArtifacts.findFirst({
    where: (table, { eq }) => eq(table.releaseId, releaseId),
  });

  if (!artifact) {
    return new Response("Not found", { status: 404 });
  }

  let resolvedAssetPath: string;
  try {
    resolvedAssetPath = normalizeRequestedReleaseAssetPath(
      assetPath,
      artifact.entryPath,
    );
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const storage = getReleaseStorage();
  let servedAssetPath = resolvedAssetPath;
  let objectHead = await storage.headObject(
    buildReleaseSiteObjectKey(artifact.siteRootKey, servedAssetPath),
  );

  if (!objectHead && isHostedReleaseSpaFallbackPath(resolvedAssetPath)) {
    servedAssetPath = artifact.entryPath;
    objectHead = await storage.headObject(
      buildReleaseSiteObjectKey(artifact.siteRootKey, servedAssetPath),
    );
  }

  if (!objectHead) {
    return new Response("Not found", { status: 404 });
  }

  const body = await storage.readObject(
    buildReleaseSiteObjectKey(artifact.siteRootKey, servedAssetPath),
  );

  const contentType = objectHead.contentType || "application/octet-stream";
  const isHtmlDocument =
    contentType.includes("text/html") &&
    servedAssetPath === artifact.entryPath;
  const isRewritableTextAsset =
    contentType.includes("javascript") || contentType.includes("text/css");

  if (isHtmlDocument) {
    const htmlWithScopedAssets = rewriteHostedReleaseHtmlAssetUrls({
      html: body.toString("utf8"),
      gameId,
      releaseId,
    });
    const html = injectHostedReleaseHtmlRuntimeBase({
      html: htmlWithScopedAssets,
      gameId,
      releaseId,
      requestedAssetPath: resolvedAssetPath,
      entryPath: artifact.entryPath,
    });

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": getReleaseAssetCacheControl(servedAssetPath),
      },
    });
  }

  if (isRewritableTextAsset) {
    const rewritten = rewriteHostedReleaseTextAssetUrls({
      content: body.toString("utf8"),
      gameId,
      releaseId,
    });

    return new Response(rewritten, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": getReleaseAssetCacheControl(servedAssetPath),
      },
    });
  }

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": getReleaseAssetCacheControl(servedAssetPath),
    },
  });
}
