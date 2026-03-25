import { describe, expect, it } from "vitest";
import { validateArcadeBridgeAttachEpoch } from "../src/runtime/validate-arcade-bridge-attach";

describe("validateArcadeBridgeAttachEpoch", () => {
  it("accepts first attach with identity", () => {
    const r = validateArcadeBridgeAttachEpoch(null, {
      epoch: 2,
      kind: "game",
      gameId: "pong",
    });
    expect(r).toEqual({ ok: true, nextLast: 2 });
  });

  it("accepts increasing epoch", () => {
    const r = validateArcadeBridgeAttachEpoch(2, {
      epoch: 3,
      kind: "browser",
      gameId: null,
    });
    expect(r).toEqual({ ok: true, nextLast: 3 });
  });

  it("accepts same epoch (idempotent re-attach)", () => {
    const r = validateArcadeBridgeAttachEpoch(3, {
      epoch: 3,
      kind: "game",
      gameId: "pong",
    });
    expect(r).toEqual({ ok: true, nextLast: 3 });
  });

  it("rejects strictly lower epoch", () => {
    const r = validateArcadeBridgeAttachEpoch(5, {
      epoch: 4,
      kind: "game",
      gameId: "pong",
    });
    expect(r).toEqual({ ok: false });
  });

  it("leaves last unchanged when identity is absent", () => {
    const r = validateArcadeBridgeAttachEpoch(2, undefined);
    expect(r).toEqual({ ok: true, nextLast: 2 });
  });

  it("accepts identity when last was never set from identity", () => {
    const r = validateArcadeBridgeAttachEpoch(null, {
      epoch: 1,
      kind: "game",
      gameId: "pong",
    });
    expect(r).toEqual({ ok: true, nextLast: 1 });
  });
});
