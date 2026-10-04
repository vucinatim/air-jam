import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReleaseDetailPanels } from "./release-detail-panels";

const renderReports = (
  reports: ComponentProps<typeof ReleaseDetailPanels>["reports"],
) =>
  renderToStaticMarkup(
    createElement(ReleaseDetailPanels, {
      generations: [],
      candidateGeneration: null,
      promotedGeneration: null,
      checks: [],
      jobs: [],
      reports,
    }),
  );

describe("ReleaseDetailPanels report privacy", () => {
  const metadata = {
    id: "report-1",
    releaseId: "release-1",
    status: "open",
    source: "play_page",
    createdAt: "2026-09-12T12:00:00Z",
    reviewedAt: null,
  };

  it("renders creator report metadata without requiring private contents", () => {
    const markup = renderReports([metadata]);
    expect(markup).toContain("Player report");
    expect(markup).toContain(">open<");
    expect(markup).toContain(
      "Report text and contact details are private to Air Jam operators",
    );
    expect(markup).toContain("not shared with game creators");
    expect(markup).not.toContain("undefined");
  });

  it("preserves private details when supplied by the authorized operator endpoint", () => {
    const markup = renderReports([
      {
        ...metadata,
        reason: "Misleading payment request",
        details: "The game asks for a bank transfer.",
        reporterEmail: "player@example.test",
      },
    ]);
    expect(markup).toContain("Misleading payment request");
    expect(markup).toContain("The game asks for a bank transfer.");
    expect(markup).toContain("player@example.test");
    expect(markup).not.toContain("Player report");
  });

  it("keeps the empty state and privacy explanation clear", () => {
    const markup = renderReports([]);
    expect(markup).toContain("No reports filed.");
    expect(markup).toContain("not shared with game creators");
  });
});
