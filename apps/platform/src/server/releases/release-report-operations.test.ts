import type { db } from "@/db";
import { describe, expect, it, vi } from "vitest";
import {
  decideReleaseReportForOperator,
  listReleaseReportsForOperator,
  reportDecisionInputSchema,
  reportListInputSchema,
} from "./release-report-operations";

describe("release report operator input boundary", () => {
  it("defaults to a bounded list and preserves explicit filters/cursor", () => {
    expect(reportListInputSchema.parse({})).toEqual({ limit: 25 });
    expect(
      reportListInputSchema.parse({
        status: "open",
        releaseId: " release-1 ",
        beforeId: " report-2 ",
        limit: 100,
      }),
    ).toEqual({
      status: "open",
      releaseId: "release-1",
      beforeId: "report-2",
      limit: 100,
    });
  });

  it.each([0, -1, 101, 1.5, Number.POSITIVE_INFINITY])(
    "rejects invalid list limit %s before IO",
    async (limit) => {
      const select = vi.fn();
      await expect(
        listReleaseReportsForOperator({
          database: { select } as unknown as typeof db,
          input: { limit },
        }),
      ).rejects.toThrow();
      expect(select).not.toHaveBeenCalled();
    },
  );

  const decision = {
    reportId: "report-1",
    expectedRevision: 0,
    status: "reviewed" as const,
    actor: "operator",
    reason: "Reviewed evidence",
    idempotencyKey: "command-1",
  };

  it.each([
    { reportId: " " },
    { actor: " " },
    { reason: " " },
    { idempotencyKey: " " },
    { expectedRevision: -1 },
    { expectedRevision: 1.5 },
    { expectedRevision: 2147483647 },
    { reason: "a".repeat(2001) },
  ])(
    "rejects invalid decision %j before entering a transaction",
    async (patch) => {
      const transaction = vi.fn();
      await expect(
        decideReleaseReportForOperator({
          database: { transaction } as unknown as typeof db,
          input: { ...decision, ...patch },
        }),
      ).rejects.toThrow();
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it("normalizes decision text and rejects extra effect fields", () => {
    expect(
      reportDecisionInputSchema.parse({
        ...decision,
        actor: " operator ",
        reason: " Reviewed evidence ",
      }),
    ).toEqual(decision);
    expect(() =>
      reportDecisionInputSchema.parse({ ...decision, quarantineRelease: true }),
    ).toThrow();
    expect(() =>
      reportListInputSchema.parse({ includeReporterEmail: true }),
    ).toThrow();
  });
});
