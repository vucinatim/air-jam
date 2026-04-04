import { getSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";

import {
  docsPageDefinitionSchema,
  docsSearchEntrySchema,
  type DocsPageDefinition,
  type DocsSearchEntry,
  type DocsSection,
} from "./schema";
import type { DocsDocument } from "./source";

export function defineDocsPage(
  page: DocsPageDefinition,
): Readonly<DocsPageDefinition> {
  return docsPageDefinitionSchema.parse(page);
}

export function createDocsPageMetadata(page: DocsPageDefinition): Metadata {
  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}${page.href}`;

  return {
    title: `${page.title} | Air Jam Docs`,
    description: page.description,
    keywords: page.keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: `${page.title} | Air Jam Docs`,
      description: page.description,
      siteName: "Air Jam",
    },
    twitter: {
      card: "summary_large_image",
      title: `${page.title} | Air Jam Docs`,
      description: page.description,
    },
    category: page.docType,
  };
}

export function buildDocsJsonLd(page: DocsPageDefinition) {
  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}${page.href}`;

  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: page.title,
    description: page.description,
    url: canonicalUrl,
    articleSection: page.section,
    keywords: page.keywords,
    audience: {
      "@type": "Audience",
      audienceType: page.audience ?? "user",
    },
    about: [
      {
        "@type": "SoftwareApplication",
        name: "Air Jam",
      },
    ],
  };
}

export function buildDocsSections(
  pages: readonly DocsPageDefinition[],
): DocsSection[] {
  const sections = new Map<string, DocsPageDefinition[]>();

  for (const page of pages) {
    const existingPages = sections.get(page.section);
    if (existingPages) {
      existingPages.push(page);
      continue;
    }

    sections.set(page.section, [page]);
  }

  return Array.from(sections.entries(), ([title, sectionPages]) => ({
    title,
    pages: [...sectionPages].sort((left, right) => left.order - right.order),
  }));
}

export function buildDocsSearchEntries(
  documents: readonly DocsDocument[],
): DocsSearchEntry[] {
  return documents.flatMap((document) => {
    const pageEntry = docsSearchEntrySchema.parse({
      kind: "page",
      title: document.page.title,
      section: document.page.section,
      href: document.page.href,
      description: document.page.description,
      keywords: document.page.keywords,
      docType: document.page.docType,
      icon: document.page.icon,
    });

    const headingEntries = document.headings
      .filter((heading) => heading.depth > 1)
      .map((heading) =>
        docsSearchEntrySchema.parse({
          kind: "heading",
          title: heading.title,
          section: document.page.section,
          href: `${document.page.href}#${heading.slug}`,
          description:
            heading.excerpt?.trim() || `Section in ${document.page.title}`,
          keywords: [
            ...document.page.keywords,
            document.page.title,
            heading.title,
          ],
          docType: document.page.docType,
          icon: document.page.icon,
          pageTitle: document.page.title,
          depth: heading.depth,
        }),
      );

    return [pageEntry, ...headingEntries];
  });
}
