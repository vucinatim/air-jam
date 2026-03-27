import { contentDocsSource } from "./content-docs-source";
import { loadDocsCollection } from "./loader";
import type {
  DocsManifestEntry,
  DocsPage,
  DocsSearchEntry,
  DocsSection,
} from "./schema";
import type { DocsDocument } from "./source";

const docsCollection = loadDocsCollection(contentDocsSource);

export const docsDocuments = docsCollection.documents;
export const docsPages = docsCollection.pages;
export const docsSections = docsCollection.sections;
export const docsManifestEntries = docsCollection.manifestEntries;
export const docsSearchEntries = docsCollection.searchEntries;
export const defaultDocsHref = docsCollection.defaultHref;

export function getDocsSections(): DocsSection[] {
  return docsSections;
}

export function getDocsPages(): DocsPage[] {
  return docsPages;
}

export function getDocsDocuments(): DocsDocument[] {
  return docsDocuments;
}

export function getDefaultDocsHref(): `/docs${string}` {
  return defaultDocsHref;
}

export function getDocsManifestEntries(): DocsManifestEntry[] {
  return docsManifestEntries;
}

export function getDocsSearchEntries(): DocsSearchEntry[] {
  return docsSearchEntries;
}

export function getDocsStaticParams(): Array<{ slug: string[] }> {
  return docsPages.map((page) => ({
    slug: toDocsSlug(page.href),
  }));
}

export function getDocsDocumentBySlug(
  slug: string[] | undefined,
): DocsDocument | null {
  if (!slug || slug.length === 0) {
    return null;
  }

  const normalizedSlug = slug.join("/");
  return (
    docsDocuments.find(
      (document) => toDocsSlugKey(document.page.href) === normalizedSlug,
    ) ?? null
  );
}

export function buildLlmsTxt(siteUrl: string): string {
  const lines = [
    "# Air Jam",
    "",
    "> Air Jam is a multiplayer game platform and SDK for QR-code-based phone controllers.",
    "",
    "## Preferred Docs",
    ...docsPages.map(
      (page) => `- ${page.title}: ${siteUrl}${page.href} (${page.description})`,
    ),
    "",
    "## Machine-Readable Endpoints",
    `- Docs Manifest: ${siteUrl}/docs-manifest`,
    `- Docs Search Index: ${siteUrl}/docs-search-index`,
    `- Sitemap: ${siteUrl}/sitemap.xml`,
    `- Robots: ${siteUrl}/robots.txt`,
    "",
    "## Notes For Agents",
    "- Prefer docs pages over marketing pages for implementation details.",
    "- Code blocks are server-rendered in docs and intended for machine extraction.",
  ];

  return `${lines.join("\n")}\n`;
}

function toDocsSlug(href: `/docs${string}`): string[] {
  return toDocsSlugKey(href).split("/");
}

function toDocsSlugKey(href: `/docs${string}`): string {
  return href.replace(/^\/docs\//, "");
}
