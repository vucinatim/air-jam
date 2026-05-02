import { contentBlogSource } from "./content-blog-source";
import { loadBlogCollection } from "./loader";
import type { BlogPost } from "./schema";
import type { BlogDocument } from "./source";

const blogCollection = loadBlogCollection(contentBlogSource);

export const blogDocuments = blogCollection.documents;
export const blogPosts = blogCollection.posts;

export function getBlogDocuments(): BlogDocument[] {
  return blogDocuments;
}

export function getBlogPosts(): BlogPost[] {
  return blogPosts;
}

export function getLatestBlogPosts(limit: number): BlogPost[] {
  return blogPosts.slice(0, limit);
}

export function getBlogStaticParams(): Array<{ slug: string }> {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export function getBlogDocumentBySlug(slug: string): BlogDocument | null {
  return blogDocuments.find((document) => document.post.slug === slug) ?? null;
}
