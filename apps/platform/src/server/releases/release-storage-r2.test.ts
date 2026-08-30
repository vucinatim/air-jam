import { describe, expect, it } from "vitest";
import { assertR2DeleteObjectsSucceeded } from "./release-storage-r2";

describe("R2 release storage deletion", () => {
  it("accepts a complete bulk-delete response", () => {
    expect(() => assertR2DeleteObjectsSucceeded(undefined)).not.toThrow();
    expect(() => assertR2DeleteObjectsSucceeded([])).not.toThrow();
  });

  it("fails closed on per-object errors without exposing object keys", () => {
    const secretKey = "games/private/resource/source.zip";
    const errors = [
      { Code: "AccessDenied", Key: secretKey },
      { Code: "AccessDenied" },
    ];
    const operation = () => assertR2DeleteObjectsSucceeded(errors);

    expect(operation).toThrow("R2 rejected 2 object deletions (AccessDenied).");
    try {
      operation();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(secretKey);
    }
  });
});
