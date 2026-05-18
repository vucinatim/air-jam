import type { BlogCollection, BlogSource } from "./source";

/**
 * When PLATFORM_INCLUDE_DRAFTS=1 is set (intended for local dev preview only),
 * drafts (`published: false`) appear in the listing and at /blog/<slug>. The
 * env is read at module load time, which matches the platform's static-rendering
 * model — production builds with the flag unset behave exactly as before.
 */
const includeDrafts = process.env.PLATFORM_INCLUDE_DRAFTS === "1";

export function loadBlogCollection(source: BlogSource): BlogCollection {
  const documents = [...source.loadDocuments()]
    .filter((document) => includeDrafts || document.post.published)
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
