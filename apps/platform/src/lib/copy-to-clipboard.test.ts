// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { copyToClipboard } from "./copy-to-clipboard";

describe("copyToClipboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    await expect(copyToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when clipboard write fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      writable: true,
      value: execCommand,
    });

    await expect(copyToClipboard("hello")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });
});
