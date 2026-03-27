import { describe, expect, it } from "vitest";
import {
  buildDocsJsonLd,
  buildLlmsTxt,
  contentDocsSource,
  getDefaultDocsHref,
  getDocsDocumentBySlug,
  getDocsDocuments,
  getDocsManifestEntries,
  getDocsPages,
  getDocsSearchEntries,
  getDocsSections,
  getDocsStaticParams,
  loadDocsCollection,
} from "./index";

describe("docs registry", () => {
  it("keeps docs navigation and manifest entries aligned", () => {
    const sections = getDocsSections();
    const pages = getDocsPages();
    const manifestEntries = getDocsManifestEntries();
    const searchEntries = getDocsSearchEntries();

    expect(sections).toHaveLength(4);
    expect(pages).toHaveLength(10);
    expect(manifestEntries).toHaveLength(pages.length);
    expect(searchEntries.length).toBeGreaterThan(pages.length);
  });

  it("uses the first docs page as the default redirect target", () => {
    expect(getDefaultDocsHref()).toBe("/docs/getting-started/introduction");
  });

  it("keeps docs hrefs unique", () => {
    const hrefs = getDocsPages().map((page) => page.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("includes machine endpoints in llms.txt", () => {
    const llmsTxt = buildLlmsTxt("https://air-jam.test");

    expect(llmsTxt).toContain("https://air-jam.test/docs-manifest");
    expect(llmsTxt).toContain("https://air-jam.test/docs-search-index");
  });

  it("loads docs through the content source adapter", () => {
    const docsCollection = loadDocsCollection(contentDocsSource);

    expect(contentDocsSource.name).toBe("content-docs");
    expect(docsCollection.pages).toHaveLength(10);
    expect(docsCollection.sections).toHaveLength(4);
    expect(docsCollection.defaultHref).toBe(
      "/docs/getting-started/introduction",
    );
  });

  it("resolves documents and static params from docs hrefs", () => {
    expect(getDocsDocuments()).toHaveLength(10);
    expect(getDocsStaticParams()).toContainEqual({
      slug: ["getting-started", "introduction"],
    });
    expect(getDocsDocumentBySlug(["sdk", "hooks"])?.page.title).toBe("Hooks");
    expect(getDocsDocumentBySlug(undefined)).toBeNull();
    expect(getDocsDocumentBySlug(["missing"])).toBeNull();
  });

  it("adds heading-level search entries with anchor hrefs", () => {
    const headingEntry = getDocsSearchEntries().find(
      (entry) =>
        entry.kind === "heading" &&
        entry.href === "/docs/getting-started/introduction#quick-start",
    );

    expect(headingEntry).toMatchObject({
      kind: "heading",
      title: "Quick Start",
      pageTitle: "Introduction",
    });
  });

  it("includes section excerpts in heading-level search entries", () => {
    const headingEntry = getDocsSearchEntries().find(
      (entry) =>
        entry.kind === "heading" &&
        entry.href === "/docs/for-agents#what-air-jam-is",
    );

    expect(headingEntry?.description).toContain(
      "multiplayer game platform and SDK",
    );
  });

  it("falls back to code signatures for type-only sections", () => {
    const headingEntry = getDocsSearchEntries().find(
      (entry) =>
        entry.kind === "heading" &&
        entry.href === "/docs/sdk/hooks#hapticsignalpayload",
    );

    expect(headingEntry?.description).toContain("pattern:");
    expect(headingEntry?.description).not.toBe("Section in Hooks");
  });

  it("keeps manifest metadata explicit enough for docs consumers", () => {
    expect(
      getDocsManifestEntries().every(
        (page) => page.stability === "evolving" && page.audience,
      ),
    ).toBe(true);
  });

  it("builds structured data for docs pages", () => {
    const introductionPage = getDocsPages().find(
      (page) => page.href === "/docs/getting-started/introduction",
    );

    expect(introductionPage).toBeDefined();
    expect(buildDocsJsonLd(introductionPage!)).toMatchObject({
      "@type": "TechArticle",
      headline: "Introduction",
      articleSection: "Getting Started",
    });
  });
});
