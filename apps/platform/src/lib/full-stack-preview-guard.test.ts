import { describe, expect, it } from "vitest";
import {
  isInactiveFullStackPreviewRequest,
  isManagedFullStackPreviewHost,
} from "./full-stack-preview-guard";

describe("full stack preview guard", () => {
  it("recognizes managed full-stack preview hosts", () => {
    expect(isManagedFullStackPreviewHost("full-pr-10.preview.airjam.io")).toBe(
      true,
    );
    expect(isManagedFullStackPreviewHost("pr-10.preview.airjam.io")).toBe(false);
    expect(isManagedFullStackPreviewHost("airjam.io")).toBe(false);
  });

  it("allows the active aliased full-stack preview deployment", () => {
    expect(
      isInactiveFullStackPreviewRequest({
        requestHost: "full-pr-10.preview.airjam.io",
        activePreviewHost: "full-pr-10.preview.airjam.io",
      }),
    ).toBe(false);
  });

  it("treats wildcard fallthrough as an inactive preview", () => {
    expect(
      isInactiveFullStackPreviewRequest({
        requestHost: "full-pr-10.preview.airjam.io",
        activePreviewHost: "full-pr-999.preview.airjam.io",
      }),
    ).toBe(true);
  });

  it("fails closed when a managed preview host is served without explicit deployment identity", () => {
    expect(
      isInactiveFullStackPreviewRequest({
        requestHost: "full-pr-10.preview.airjam.io",
        activePreviewHost: null,
      }),
    ).toBe(true);
  });

  it("never blocks normal production or native vercel preview hosts", () => {
    expect(
      isInactiveFullStackPreviewRequest({
        requestHost: "airjam.io",
        activePreviewHost: null,
      }),
    ).toBe(false);
    expect(
      isInactiveFullStackPreviewRequest({
        requestHost: "air-jam-git-main-timvucina.vercel.app",
        activePreviewHost: null,
      }),
    ).toBe(false);
  });
});
