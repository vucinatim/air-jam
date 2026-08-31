import { createLoginHref } from "@/lib/auth-redirect";
import { resolvePlatformDeploymentConfig } from "@/lib/platform-deployment-config";
import { isPlatformLivenessPath } from "@/lib/platform-service-contract";
import type { ProductTelemetryAgentResource } from "@/lib/product-telemetry-contract";
import {
  assessHostedReleaseOrigin,
  isHostedReleaseOriginRequired,
} from "@/lib/releases/hosted-release-origin";
import { normalizePlatformRequestHost } from "@/lib/request-host-policy";
import { recordAgentResourceRequestBestEffort } from "@/server/product-telemetry/agent-resource";
import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from "next/server";

const AGENT_RESOURCE_BY_PATHNAME = {
  "/llms.txt": "llms_txt",
  "/docs-manifest": "docs_manifest",
  "/docs-search-index": "docs_search_index",
  "/ai-pack/manifest.json": "ai_pack_manifest",
} as const satisfies Record<string, ProductTelemetryAgentResource>;

const isHostedReleasePath = (pathname: string): boolean =>
  pathname === "/releases" || pathname.startsWith("/releases/");

export type HostedReleaseRequestDisposition =
  | { kind: "platform" }
  | { kind: "serve_release" }
  | { kind: "block_release_origin" }
  | { kind: "block_unknown_host" }
  | { kind: "release_unavailable"; reason: string }
  | { kind: "redirect_release"; destination: string };

export const resolveHostedReleaseRequestDisposition = (
  requestUrl: string | URL,
  requestHost: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): HostedReleaseRequestDisposition => {
  const url = new URL(requestUrl);
  const assessment = assessHostedReleaseOrigin(env);
  const deployment = resolvePlatformDeploymentConfig(env);
  const incomingHost = normalizePlatformRequestHost(requestHost);
  const isReleaseOriginHost =
    assessment.status === "ready" &&
    incomingHost === new URL(assessment.publicOrigin).host;
  if (isPlatformLivenessPath(url.pathname) && !isReleaseOriginHost) {
    return { kind: "platform" };
  }
  const isReleasePath = isHostedReleasePath(url.pathname);
  const isPlatformHost =
    incomingHost !== null &&
    (incomingHost === new URL(deployment.platformPublicOrigin).host ||
      deployment.platformRequestHosts.includes(incomingHost));
  const isLocalDevelopment =
    env.NODE_ENV !== "production" && !env.RAILWAY_ENVIRONMENT_NAME;

  if (assessment.status !== "ready") {
    if (!isPlatformHost && !isLocalDevelopment) {
      return { kind: "block_unknown_host" };
    }
    if (
      assessment.status === "disabled" &&
      !isHostedReleaseOriginRequired(env)
    ) {
      return isReleasePath
        ? { kind: "release_unavailable", reason: assessment.reason }
        : { kind: "platform" };
    }
    return isReleasePath
      ? {
          kind: "release_unavailable",
          reason: assessment.reason,
        }
      : { kind: "platform" };
  }

  if (isReleaseOriginHost) {
    return isReleasePath
      ? { kind: "serve_release" }
      : { kind: "block_release_origin" };
  }

  if (!isPlatformHost) {
    return { kind: "block_unknown_host" };
  }

  if (isReleasePath) {
    return {
      kind: "redirect_release",
      destination: new URL(
        `${url.pathname}${url.search}`,
        assessment.publicOrigin,
      ).toString(),
    };
  }

  return { kind: "platform" };
};

export const resolveAgentResource = (
  pathname: string,
): ProductTelemetryAgentResource | null =>
  AGENT_RESOURCE_BY_PATHNAME[
    pathname as keyof typeof AGENT_RESOURCE_BY_PATHNAME
  ] ?? null;

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const releaseDisposition = resolveHostedReleaseRequestDisposition(
    request.url,
    request.headers.get("host"),
  );
  if (
    releaseDisposition.kind === "block_release_origin" ||
    releaseDisposition.kind === "block_unknown_host"
  ) {
    return new NextResponse("Not found", {
      status: 404,
      headers: {
        "cache-control": "no-store",
        "x-airjam-content-class": "untrusted-release",
      },
    });
  }
  if (releaseDisposition.kind === "release_unavailable") {
    return new NextResponse("Hosted release delivery is unavailable", {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "x-airjam-release-status": "unavailable",
      },
    });
  }
  if (releaseDisposition.kind === "redirect_release") {
    const response = NextResponse.redirect(releaseDisposition.destination, 307);
    response.headers.set("cache-control", "no-store");
    return response;
  }
  if (releaseDisposition.kind === "serve_release") {
    const response = NextResponse.next();
    response.headers.set("x-airjam-content-class", "untrusted-release");
    return response;
  }

  const resource = resolveAgentResource(request.nextUrl.pathname);

  if (resource) {
    event.waitUntil(
      recordAgentResourceRequestBestEffort({ resource, request }),
    );
  }

  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const sessionCookie = request.cookies.get("better-auth.session_token");
    const secureSessionCookie = request.cookies.get(
      "__Secure-better-auth.session_token",
    );

    if (!sessionCookie && !secureSessionCookie) {
      const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
      return NextResponse.redirect(
        new URL(createLoginHref(nextPath), request.url),
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
