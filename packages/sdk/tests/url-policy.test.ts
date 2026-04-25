import { describe, expect, it } from "vitest";
import {
  appendRuntimeQueryParams,
  getRuntimeUrlOrigin,
  isTrustedRuntimeMessageOrigin,
  normalizeRuntimeUrl,
  runtimeUrlSchema,
} from "../src/protocol/url-policy";

describe("runtime url policy", () => {
  it("normalizes valid http(s) URLs", () => {
    expect(normalizeRuntimeUrl("https://example.com/game")).toBe(
      "https://example.com/game",
    );
    expect(normalizeRuntimeUrl("http://localhost:5173/controller")).toBe(
      "http://localhost:5173/controller",
    );
  });

  it("rejects invalid protocols and credentialed URLs", () => {
    expect(normalizeRuntimeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeRuntimeUrl("data:text/html,hi")).toBeNull();
    expect(normalizeRuntimeUrl("https://user:pass@example.com")).toBeNull();
  });

  it("extracts origin and validates message origin", () => {
    const url = "https://game.example/path?a=1";
    expect(getRuntimeUrlOrigin(url)).toBe("https://game.example");
    expect(isTrustedRuntimeMessageOrigin(url, "https://game.example")).toBe(
      true,
    );
    expect(isTrustedRuntimeMessageOrigin(url, "https://other.example")).toBe(
      false,
    );
  });

  it("appends query params safely", () => {
    expect(
      appendRuntimeQueryParams("https://game.example/play?foo=bar", {
        aj_room: "ABCD",
        aj_cap: "join_123",
      }),
    ).toBe("https://game.example/play?foo=bar&aj_room=ABCD&aj_cap=join_123");

    expect(
      appendRuntimeQueryParams("javascript:alert(1)", {
        aj_room: "ABCD",
      }),
    ).toBeNull();
  });

  it("schema enforces runtime URL policy", () => {
    expect(runtimeUrlSchema.safeParse("https://example.com").success).toBe(
      true,
    );
    expect(runtimeUrlSchema.safeParse("javascript:alert(1)").success).toBe(
      false,
    );
  });
});
