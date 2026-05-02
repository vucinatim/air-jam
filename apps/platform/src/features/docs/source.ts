import type { Metadata } from "next";
import type { ComponentType } from "react";

import type {
  DocsHeading,
  DocsManifestEntry,
  DocsPage,
  DocsSearchEntry,
  DocsSection,
} from "./schema";

export type DocsDocument = {
  page: DocsPage;
  metadata: Metadata;
  headings: DocsHeading[];
  sourcePath: string;
  loadComponent: () => Promise<{ default: ComponentType }>;
};

export type DocsCollection = {
  documents: DocsDocument[];
  pages: DocsPage[];
  sections: DocsSection[];
  manifestEntries: DocsManifestEntry[];
  searchEntries: DocsSearchEntry[];
  defaultHref: `/docs${string}`;
};

export interface DocsSource {
  name: string;
  loadDocuments(): readonly DocsDocument[];
}
