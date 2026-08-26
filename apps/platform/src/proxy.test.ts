import { NextRequest, type NextFetchEvent } from "next/server";
import { describe, expect, it, vi } from "vitest";

const recordAgentResourceRequestBestEffort = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);

vi.mock("@/server/product-telemetry/agent-resource", () => ({
  recordAgentResourceRequestBestEffort,
}));

import { config, proxy, resolveAgentResource } from "./proxy";

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
    expect(config.matcher).toEqual([
      "/dashboard/:path*",
      "/llms.txt",
      "/docs-manifest",
      "/docs-search-index",
      "/ai-pack/manifest.json",
    ]);
  });
});
