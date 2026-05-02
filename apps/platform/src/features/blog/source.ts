import type { Metadata } from "next";
import type { ComponentType } from "react";

import type { BlogPost } from "./schema";

export type BlogDocument = {
  post: BlogPost;
  metadata: Metadata;
  sourcePath: string;
  loadComponent: () => Promise<{ default: ComponentType }>;
};

export type BlogCollection = {
  documents: BlogDocument[];
  posts: BlogPost[];
};

export interface BlogSource {
  name: string;
  loadDocuments(): readonly BlogDocument[];
}
