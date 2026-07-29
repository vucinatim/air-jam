import { describe, expect, it } from "vitest";
import { resolveCorsOrigin } from "../src/origin-policy.js";

const matchesOrigin = (
  policy: ReturnType<typeof resolveCorsOrigin>,
  origin: string,
) =>
  policy === "*" ||
  policy.some((allowed) =>
    typeof allowed === "string" ? allowed === origin : allowed.test(origin),
  );

describe("resolveCorsOrigin", () => {
  it("keeps exact origins and falls back when no override is provided", () => {
    const policy = resolveCorsOrigin(undefined, [
      "https://airjam.io",
      "https://www.airjam.io",
    ]);

    expect(matchesOrigin(policy, "https://airjam.io")).toBe(true);
    expect(matchesOrigin(policy, "https://example.com")).toBe(false);
  });

  it("supports one leading subdomain wildcard without matching lookalikes", () => {
    const policy = resolveCorsOrigin(
      ["https://*.vercel.app"],
      ["https://airjam.io"],
    );

    expect(
      matchesOrigin(
        policy,
        "https://mara-in-andrej-git-main-timvucina.vercel.app",
      ),
    ).toBe(true);
    expect(
      matchesOrigin(policy, "https://mara-in-andrej-abc123.vercel.app"),
    ).toBe(true);
    expect(matchesOrigin(policy, "https://vercel.app")).toBe(false);
    expect(matchesOrigin(policy, "https://nested.preview.vercel.app")).toBe(
      false,
    );
    expect(
      matchesOrigin(policy, "https://preview.vercel.app.example.com"),
    ).toBe(false);
    expect(matchesOrigin(policy, "http://preview.vercel.app")).toBe(false);
  });

  it("preserves the explicit allow-all policy", () => {
    expect(resolveCorsOrigin("*", ["https://airjam.io"])).toBe("*");
    expect(resolveCorsOrigin(["*"], ["https://airjam.io"])).toBe("*");
  });

  it("rejects ambiguous wildcard placement", () => {
    expect(() =>
      resolveCorsOrigin(
        ["https://preview.*.vercel.app"],
        ["https://airjam.io"],
      ),
    ).toThrow(/leading subdomain wildcard/);
  });
});
