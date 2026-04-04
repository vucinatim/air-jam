import { describe, expect, it } from "vitest";
import {
  getPlayerAvatarImageUrl,
  resolvePlayerAvatarSeed,
} from "../src/utils/player-avatar-url";

describe("resolvePlayerAvatarSeed", () => {
  it("maps legacy aj-n ids to curated seeds", () => {
    expect(
      resolvePlayerAvatarSeed({
        id: "c1",
        label: "P",
        avatarId: "aj-1",
      }),
    ).toBe("Aiko");
    expect(
      resolvePlayerAvatarSeed({
        id: "c1",
        label: "P",
        avatarId: "aj-8",
      }),
    ).toBe("Harper");
  });

  it("uses player id when avatarId is missing", () => {
    expect(
      resolvePlayerAvatarSeed({ id: "xyz", label: "P" }),
    ).toBe("xyz");
  });

  it("passes through custom avatarId strings", () => {
    expect(
      resolvePlayerAvatarSeed({
        id: "c1",
        label: "P",
        avatarId: "customSeed",
      }),
    ).toBe("customSeed");
  });
});

describe("getPlayerAvatarImageUrl", () => {
  it("includes encoded seed in DiceBear URL", () => {
    const url = getPlayerAvatarImageUrl({
      id: "x",
      label: "P",
      avatarId: "aj-1",
    });
    expect(url).toContain("api.dicebear.com");
    expect(url).toContain("seed=Aiko");
  });
});
