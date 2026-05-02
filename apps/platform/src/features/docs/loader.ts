import { buildDocsSearchEntries, buildDocsSections } from "./metadata";
import { docsManifestEntrySchema } from "./schema";
import type { DocsCollection, DocsSource } from "./source";

export function loadDocsCollection(source: DocsSource): DocsCollection {
  const documents = [...source.loadDocuments()];
  const pages = documents.map((document) => document.page);
  const sections = buildDocsSections(pages);
  const manifestEntries = pages.map((page) =>
    docsManifestEntrySchema.parse(page),
  );
  const searchEntries = buildDocsSearchEntries(documents);
  const defaultHref = pages[0]?.href ?? ("/docs" as `/docs${string}`);

  return {
    documents,
    pages,
    sections,
    manifestEntries,
    searchEntries,
    defaultHref,
  };
}
