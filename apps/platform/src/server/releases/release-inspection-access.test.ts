import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createReleaseInspectionAccessToken,
  verifyReleaseInspectionAccessToken,
} from "./release-inspection-access";

const scope = {
  gameId: "game-1",
  releaseId: "release-1",
  generationId: "generation-1",
};
const secret = "secret-1";
const mint = () =>
  createReleaseInspectionAccessToken({ ...scope, secret, expiresAtMs: 10_000 });
const verify = (token: string) =>
  verifyReleaseInspectionAccessToken({ ...scope, token, secret, nowMs: 5_000 });
const signPayload = (payload: unknown, version = "v2") => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${version}.${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
};

describe("release inspection access", () => {
  it("accepts only the exact game, release, and immutable generation", () => {
    expect(mint()).toMatch(/^v2\./);
    expect(verify(mint())).toBe(true);
  });

  it.each(["gameId", "releaseId", "generationId"] as const)(
    "rejects another %s",
    (field) => {
      expect(
        verifyReleaseInspectionAccessToken({
          ...scope,
          [field]: "other",
          token: mint(),
          secret,
          nowMs: 5_000,
        }),
      ).toBe(false);
    },
  );

  it("rejects an expired token at its expiry boundary", () => {
    expect(
      verifyReleaseInspectionAccessToken({
        ...scope,
        token: mint(),
        secret,
        nowMs: 10_000,
      }),
    ).toBe(false);
  });

  it("rejects tampered payloads and wrong signing secrets", () => {
    const token = mint();
    const parts = token.split(".");
    parts[1] = Buffer.from(
      JSON.stringify({ v: "v2", ...scope, generationId: "other", exp: 10_000 }),
    ).toString("base64url");
    expect(verify(parts.join("."))).toBe(false);
    expect(
      verifyReleaseInspectionAccessToken({
        ...scope,
        token,
        secret: "wrong",
        nowMs: 5_000,
      }),
    ).toBe(false);
  });

  it("rejects raw secrets, extra envelope segments, invalid encoding, and oversized input", () => {
    const token = mint();
    for (const invalid of [
      secret,
      `${token}.extra`,
      `${token}.`,
      token.replace("v2.", "v2.=x"),
      "x".repeat(4097),
    ]) {
      expect(verify(invalid)).toBe(false);
    }
  });

  it("rejects signed legacy generation-less tokens instead of accepting old authority", () => {
    expect(
      verify(
        signPayload(
          {
            v: "v1",
            gameId: scope.gameId,
            releaseId: scope.releaseId,
            exp: 10_000,
          },
          "v1",
        ),
      ),
    ).toBe(false);
    expect(
      verify(
        signPayload({
          v: "v2",
          gameId: scope.gameId,
          releaseId: scope.releaseId,
          exp: 10_000,
        }),
      ),
    ).toBe(false);
  });

  it.each([
    null,
    [],
    { v: "v2", ...scope, exp: 10_000, extra: true },
    { v: "v2", ...scope, generationId: "", exp: 10_000 },
    { v: "v2", ...scope, generationId: "x".repeat(257), exp: 10_000 },
    { v: "v2", ...scope, exp: 10_000.5 },
    { v: "v2", ...scope, exp: -1 },
  ])("rejects a signed malformed payload %#", (payload) => {
    expect(verify(signPayload(payload))).toBe(false);
  });

  it("does not mint malformed generation scopes", () => {
    expect(() =>
      createReleaseInspectionAccessToken({
        ...scope,
        generationId: "",
        secret,
        expiresAtMs: 10_000,
      }),
    ).toThrow();
  });
});
