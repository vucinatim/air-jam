import type { db } from "@/db";
import { publicReleaseReportInputSchema } from "@/lib/releases/release-report-policy";
import { describe, expect, it, vi } from "vitest";
import { submitPublicReleaseReport } from "./release-report-intake";

const input = {
  submissionId: "80699779-f869-4167-853a-fb792af01718",
  releaseId: "release-1",
  source: "arcade" as const,
  reason: "Report evidence",
};

describe("public release report intake input", () => {
  it("normalizes bounded report text without accepting additional effect fields", () => {
    expect(
      publicReleaseReportInputSchema.parse({
        ...input,
        reason: " Report evidence ",
        details: " details ",
        reporterEmail: " reporter@example.invalid ",
      }),
    ).toEqual({
      ...input,
      details: "details",
      reporterEmail: "reporter@example.invalid",
    });
    expect(() =>
      publicReleaseReportInputSchema.parse({ ...input, status: "dismissed" }),
    ).toThrow();
    expect(() =>
      publicReleaseReportInputSchema.parse({ ...input, slugOrId: "game" }),
    ).toThrow();
  });

  it.each([
    { submissionId: "not-a-uuid" },
    { releaseId: " " },
    { reason: "ab" },
    { reason: "a".repeat(121) },
    { details: "a".repeat(2001) },
    { reporterEmail: "not-email" },
  ])("rejects malformed input before database access %j", async (patch) => {
    const transaction = vi.fn();
    await expect(
      submitPublicReleaseReport({
        database: { transaction } as unknown as typeof db,
        input: { ...input, ...patch },
      }),
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
});
