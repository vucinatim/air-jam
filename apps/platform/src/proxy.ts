import { createLoginHref } from "@/lib/auth-redirect";
import type { ProductTelemetryAgentResource } from "@/lib/product-telemetry-contract";
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

export const resolveAgentResource = (
  pathname: string,
): ProductTelemetryAgentResource | null =>
  AGENT_RESOURCE_BY_PATHNAME[
    pathname as keyof typeof AGENT_RESOURCE_BY_PATHNAME
  ] ?? null;

export function proxy(request: NextRequest, event: NextFetchEvent) {
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
  matcher: [
    "/dashboard/:path*",
    "/llms.txt",
    "/docs-manifest",
    "/docs-search-index",
    "/ai-pack/manifest.json",
  ],
};
