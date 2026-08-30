import { NextRequest, type NextFetchEvent } from "next/server";
import { describe, expect, it, vi } from "vitest";

const recordAgentResourceRequestBestEffort = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);

vi.mock("@/server/product-telemetry/agent-resource", () => ({
  recordAgentResourceRequestBestEffort,
}));

import {
  config,
  proxy,
  resolveAgentResource,
  resolveHostedReleaseRequestDisposition,
} from "./proxy";

const makeEvent = () => ({ waitUntil: vi.fn() }) as unknown as NextFetchEvent;

describe("agent-resource proxy", () => {
  it.each([
    ["/llms.txt", "llms_txt"],
    ["/docs-manifest", "docs_manifest"],
    ["/docs-search-index", "docs_search_index"],
    ["/ai-pack/manifest.json", "ai_pack_manifest"],
  ] as const)("maps %s to %s", (pathname, resource) => {
    expect(resolveAgentResource(pathname)).toBe(resource);
  });

  it("does not classify arbitrary public routes", () => {
    expect(resolveAgentResource("/docs")).toBeNull();
    expect(resolveAgentResource("/ai-pack/stable/manifest.json")).toBeNull();
  });

  it("records a classified resource without changing its response lane", () => {
    const request = new NextRequest("https://airjam.io/llms.txt");
    const event = makeEvent();
    const response = proxy(request, event);

    expect(recordAgentResourceRequestBestEffort).toHaveBeenCalledWith({
      resource: "llms_txt",
      request,
    });
    expect(event.waitUntil).toHaveBeenCalledOnce();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("preserves the dashboard authentication redirect", () => {
    const response = proxy(
      new NextRequest("https://airjam.io/dashboard/ops/telemetry?days=30"),
      makeEvent(),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "%2Fdashboard%2Fops%2Ftelemetry",
    );
  });

  it("allows an authenticated dashboard request to continue", () => {
    const response = proxy(
      new NextRequest("https://airjam.io/dashboard/ops/telemetry", {
        headers: { cookie: "better-auth.session_token=session" },
      }),
      makeEvent(),
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps the matcher aligned with every observed resource", () => {
    expect(config.matcher).toEqual(["/:path*"]);
  });
});

const releaseEnv = {
  NODE_ENV: "production",
  NEXT_PUBLIC_APP_URL: "https://airjam.io",
  AIRJAM_RELEASES_PUBLIC_ORIGIN: "https://airjamusercontent.net",
} as NodeJS.ProcessEnv;

describe("hosted release request routing", () => {
  it("serves only release paths requested directly from the release origin", () => {
    expect(
      resolveHostedReleaseRequestDisposition(
        "https://airjamusercontent.net/releases/g/game-1/r/release-1/index.html",
        "airjamusercontent.net",
        releaseEnv,
      ),
    ).toEqual({ kind: "serve_release" });
    expect(
      resolveHostedReleaseRequestDisposition(
        "https://airjamusercontent.net/dashboard",
        "airjamusercontent.net",
        releaseEnv,
      ),
    ).toEqual({ kind: "block_release_origin" });
  });

  it("redirects platform release paths to the isolated origin without losing query state", () => {
    expect(
      resolveHostedReleaseRequestDisposition(
        "https://airjam.io/releases/g/game-1/r/release-1/?controller=abc%201",
        "airjam.io",
        releaseEnv,
      ),
    ).toEqual({
      kind: "redirect_release",
      destination:
        "https://airjamusercontent.net/releases/g/game-1/r/release-1/?controller=abc%201",
    });
  });

  it("keeps non-release platform requests on the platform lane", () => {
    expect(
      resolveHostedReleaseRequestDisposition(
        "https://airjam.io/play/example",
        "airjam.io",
        releaseEnv,
      ),
    ).toEqual({ kind: "platform" });
  });

  it("fails closed when a release path is requested without a ready origin", () => {
    const disposition = resolveHostedReleaseRequestDisposition(
      "https://airjam.io/releases/g/game-1/r/release-1/",
      "airjam.io",
      {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://airjam.io",
      },
    );

    expect(disposition.kind).toBe("release_unavailable");
    if (disposition.kind === "release_unavailable") {
      expect(disposition.reason).toContain("delivery is disabled");
    }
  });

  it("uses the incoming Host rather than Next's server-derived request URL", () => {
    expect(
      resolveHostedReleaseRequestDisposition(
        "http://0.0.0.0:3000/dashboard",
        "airjamusercontent.net",
        releaseEnv,
      ),
    ).toEqual({ kind: "block_release_origin" });
    expect(
      resolveHostedReleaseRequestDisposition(
        "http://0.0.0.0:3000/releases",
        "airjamusercontent.net",
        releaseEnv,
      ),
    ).toEqual({ kind: "serve_release" });
    expect(
      resolveHostedReleaseRequestDisposition(
        "http://0.0.0.0:3000/dashboard",
        "attacker.example",
        releaseEnv,
      ),
    ).toEqual({ kind: "block_unknown_host" });
  });

  it("returns the security disposition as concrete proxy responses", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "production");
    vi.stubEnv("RAILWAY_PUBLIC_DOMAIN", "");
    vi.stubEnv("NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://airjam.io");
    vi.stubEnv("BETTER_AUTH_URL", "https://airjam.io");
    vi.stubEnv("BETTER_AUTH_TRUSTED_ORIGINS", "https://airjam.io");
    vi.stubEnv(
      "AIRJAM_RELEASES_PUBLIC_ORIGIN",
      "https://airjamusercontent.net",
    );

    try {
      const direct = proxy(
        new NextRequest(
          "https://airjamusercontent.net/releases/g/game-1/r/release-1/",
          { headers: { host: "airjamusercontent.net" } },
        ),
        makeEvent(),
      );
      const blocked = proxy(
        new NextRequest("https://airjamusercontent.net/login", {
          headers: { host: "airjamusercontent.net" },
        }),
        makeEvent(),
      );
      const redirected = proxy(
        new NextRequest("https://airjam.io/releases/g/game-1/r/release-1/", {
          headers: { host: "airjam.io" },
        }),
        makeEvent(),
      );

      expect(direct.headers.get("x-middleware-next")).toBe("1");
      expect(direct.headers.get("x-airjam-content-class")).toBe(
        "untrusted-release",
      );
      expect(blocked.status).toBe(404);
      expect(blocked.headers.get("cache-control")).toBe("no-store");
      expect(blocked.headers.get("x-airjam-content-class")).toBe(
        "untrusted-release",
      );
      expect(redirected.status).toBe(307);
      expect(redirected.headers.get("cache-control")).toBe("no-store");
      expect(redirected.headers.get("location")).toBe(
        "https://airjamusercontent.net/releases/g/game-1/r/release-1/",
      );

      vi.stubEnv("AIRJAM_RELEASES_PUBLIC_ORIGIN", "");
      const unavailable = proxy(
        new NextRequest("https://airjam.io/releases/g/game-1/r/release-1/", {
          headers: { host: "airjam.io" },
        }),
        makeEvent(),
      );
      expect(unavailable.status).toBe(503);
      expect(unavailable.headers.get("cache-control")).toBe("no-store");
      expect(unavailable.headers.get("x-airjam-release-status")).toBe(
        "unavailable",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
