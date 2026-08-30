import { describe, expect, it } from "vitest";
import {
  HOSTED_RELEASE_IFRAME_PERMISSIONS,
  HOSTED_RELEASE_IFRAME_SANDBOX,
} from "./hosted-release-frame-policy";

describe("hosted release iframe policy", () => {
  it("retains the capabilities required by hosted games", () => {
    const capabilities = new Set(HOSTED_RELEASE_IFRAME_SANDBOX.split(" "));

    expect(capabilities).toEqual(
      new Set([
        "allow-forms",
        "allow-modals",
        "allow-pointer-lock",
        "allow-popups",
        "allow-same-origin",
        "allow-scripts",
      ]),
    );
  });

  it("does not let hosted games escape the frame through navigation or popups", () => {
    const capabilities = new Set(HOSTED_RELEASE_IFRAME_SANDBOX.split(" "));

    expect(capabilities.has("allow-popups-to-escape-sandbox")).toBe(false);
    expect(capabilities.has("allow-top-navigation")).toBe(false);
    expect(capabilities.has("allow-top-navigation-by-user-activation")).toBe(
      false,
    );
    expect(capabilities.has("allow-top-navigation-to-custom-protocols")).toBe(
      false,
    );
  });

  it("publishes the explicit browser feature allow-list used by both frames", () => {
    expect(HOSTED_RELEASE_IFRAME_PERMISSIONS.split("; ")).toEqual([
      "accelerometer",
      "autoplay",
      "clipboard-write",
      "encrypted-media",
      "fullscreen",
      "gamepad",
      "gyroscope",
      "picture-in-picture",
      "web-share",
    ]);
  });
});
