import { describe, expect, it } from "vitest";
import { setupServerTestHarness } from "./helpers/server-test-harness";

describe("origin policy HTTP integration", () => {
  const harness = setupServerTestHarness({
    server: {
      allowedOrigins: ["https://airjam.io", "https://*.vercel.app"],
      devLogCollector: false,
    },
  });

  it("emits CORS permission for an exact or wildcard origin only", async () => {
    const exact = await fetch(`${harness.getBaseUrl()}/health`, {
      headers: { Origin: "https://airjam.io" },
    });
    const preview = await fetch(`${harness.getBaseUrl()}/health`, {
      headers: {
        Origin: "https://mara-in-andrej-abc123.vercel.app",
      },
    });
    const lookalike = await fetch(`${harness.getBaseUrl()}/health`, {
      headers: {
        Origin: "https://preview.vercel.app.example.com",
      },
    });

    expect(exact.headers.get("access-control-allow-origin")).toBe(
      "https://airjam.io",
    );
    expect(preview.headers.get("access-control-allow-origin")).toBe(
      "https://mara-in-andrej-abc123.vercel.app",
    );
    expect(lookalike.headers.get("access-control-allow-origin")).toBeNull();
  });
});
