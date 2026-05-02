import type { BlogCollection, BlogSource } from "./source";

export function loadBlogCollection(source: BlogSource): BlogCollection {
  const documents = [...source.loadDocuments()]
    .filter((document) => document.post.published)
    .sort(
      (left, right) =>
        new Date(right.post.publishedAt).getTime() -
        new Date(left.post.publishedAt).getTime(),
    );

  return {
    documents,
    posts: documents.map((document) => document.post),
  };
}
