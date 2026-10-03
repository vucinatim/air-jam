// @vitest-environment jsdom

import type { PublicReleaseReportInput } from "@/lib/releases/release-report-policy";
import { act, createElement, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getReleaseReportFailureMessage,
  useReleaseReportDraft,
} from "./use-release-report-draft";

describe("public report draft submission identity", () => {
  let root: Root;
  let current: ReturnType<typeof useReleaseReportDraft>;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    root = createRoot(document.createElement("div"));
    function Probe() {
      const draft = useReleaseReportDraft();
      useLayoutEffect(() => {
        current = draft;
      });
      return null;
    }
    act(() => root.render(createElement(Probe)));
    act(() => current.change("reason", "Misleading content"));
  });
  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });
  const begin = (releaseId = "displayed-release") => {
    let result: PublicReleaseReportInput | null = null;
    act(() => {
      result = current.begin(releaseId);
    });
    return result!;
  };

  it("binds to the displayed release and preserves the unchanged attempt after failure", () => {
    act(() => current.change("details", "A specific issue"));
    const first = begin();
    expect(first.releaseId).toBe("displayed-release");
    expect(first).not.toHaveProperty("slugOrId");
    expect(first.source).toBe("play_page");
    expect(first.submissionId).toMatch(/^[0-9a-f-]{36}$/);
    act(() => current.finish(false));
    expect(current.draft).toEqual({
      reason: "Misleading content",
      details: "A specific issue",
      reporterEmail: "",
    });
    expect(begin()).toEqual(first);
  });

  it("blocks double submission synchronously and protects the pending draft", () => {
    let first: PublicReleaseReportInput | null = null;
    let duplicate: PublicReleaseReportInput | null = null;
    act(() => {
      first = current.begin("displayed-release");
      duplicate = current.begin("displayed-release");
      current.change("reason", "Unsent edits must not be lost");
    });
    expect(first).not.toBeNull();
    expect(duplicate).toBeNull();
    expect(current.pending).toBe(true);
    expect(current.draft.reason).toBe("Misleading content");
    act(() => current.finish(false));
    expect(current.pending).toBe(false);
  });

  it("assigns a new attempt after each edited field and after changing the displayed release", () => {
    let previous = begin();
    for (const [field, value] of [
      ["reason", "New reason"],
      ["details", "New details"],
      ["reporterEmail", "player@example.test"],
    ] as const) {
      act(() => current.finish(false));
      act(() => current.change(field, value));
      const next = begin();
      expect(next.submissionId).not.toBe(previous.submissionId);
      expect(next[field]).toBe(value);
      previous = next;
    }
    act(() => current.finish(false));
    const changedRelease = begin("another-displayed-release");
    expect(changedRelease.submissionId).not.toBe(previous.submissionId);
    expect(changedRelease.releaseId).toBe("another-displayed-release");
  });

  it("clears the draft and attempt only on success", () => {
    const first = begin();
    act(() => current.finish(true));
    expect(current.draft).toEqual({
      reason: "",
      details: "",
      reporterEmail: "",
    });
    expect(current.pending).toBe(false);
    act(() => current.change("reason", "Misleading content"));
    expect(begin().submissionId).not.toBe(first.submissionId);
  });

  it("shows safe retry guidance without echoing arbitrary server errors", () => {
    expect(
      getReleaseReportFailureMessage({
        data: { code: "TOO_MANY_REQUESTS", retryAfterSeconds: 42 },
      }),
    ).toContain("retry in 42 seconds");
    expect(
      getReleaseReportFailureMessage({
        data: { code: "TOO_MANY_REQUESTS", retryAfterSeconds: null },
      }),
    ).toContain("try again shortly");
    expect(
      getReleaseReportFailureMessage({
        data: { code: "TOO_MANY_REQUESTS", retryAfterSeconds: "private text" },
      }),
    ).not.toContain("private text");
    expect(
      getReleaseReportFailureMessage({ data: { code: "NOT_FOUND" } }),
    ).toContain("release is no longer public");
    expect(
      getReleaseReportFailureMessage({ data: { code: "BAD_REQUEST" } }),
    ).toBe(
      "Check your report reason and optional email address, then try again. Your draft is preserved.",
    );
    expect(
      getReleaseReportFailureMessage({ data: { code: "CONFLICT" } }),
    ).toContain("Edit your report and submit it again");
    const message = getReleaseReportFailureMessage(
      new Error("database credentials or report contents"),
    );
    expect(message).toContain("Your draft is preserved");
    expect(message).not.toContain("database credentials");
  });
});
