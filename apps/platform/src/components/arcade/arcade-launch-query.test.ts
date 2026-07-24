import { describe, expect, it } from "vitest";
import {
  parseArcadeLaunchQuery,
  resolveInitialArcadeBrowserOverlay,
} from "./arcade-launch-query";

describe("parseArcadeLaunchQuery", () => {
  it("requests the QR overlay only for the exact qr=open contract", () => {
    expect(parseArcadeLaunchQuery({ qr: "open" })).toEqual({
      initialOverlay: "qr",
    });
  });

  it.each([
    ["an absent value", {}],
    ["an empty value", { qr: "" }],
    ["an unsupported value", { qr: "true" }],
    ["different casing", { qr: "OPEN" }],
    ["an ambiguous repeated value", { qr: ["open", "open"] }],
  ])("ignores %s", (_label, source) => {
    expect(parseArcadeLaunchQuery(source)).toEqual({
      initialOverlay: null,
    });
  });
});

describe("resolveInitialArcadeBrowserOverlay", () => {
  it("lets qr=open override a stored hidden preference", () => {
    expect(
      resolveInitialArcadeBrowserOverlay(
        parseArcadeLaunchQuery({ qr: "open" }),
        "hidden",
      ),
    ).toBe("qr");
  });

  it.each(["hidden", "qr"] as const)(
    "preserves the normal %s preference without a valid launch request",
    (fallback) => {
      expect(
        resolveInitialArcadeBrowserOverlay(
          parseArcadeLaunchQuery({ qr: "invalid" }),
          fallback,
        ),
      ).toBe(fallback);
    },
  );
});
