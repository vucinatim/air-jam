import { describe, expect, it } from "vitest";
import { normalizePlatformRequestHost } from "./request-host-policy";

describe("platform request host policy", () => {
  it("normalizes one valid request host without accepting host lists", () => {
    expect(normalizePlatformRequestHost("Games.Example.NET:8443")).toBe(
      "games.example.net:8443",
    );
    expect(
      normalizePlatformRequestHost("bad.example, attacker.example"),
    ).toBeNull();
    expect(normalizePlatformRequestHost("bad host")).toBeNull();
    expect(normalizePlatformRequestHost(null)).toBeNull();
  });
});
