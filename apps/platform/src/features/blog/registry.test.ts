import { describe, expect, it } from "vitest";

import {
  buildBlogJsonLd,
  contentBlogSource,
  getBlogDocumentBySlug,
  getBlogDocuments,
  getBlogPosts,
  getBlogStaticParams,
  loadBlogCollection,
} from "./index";

describe("blog registry", () => {
  it("loads blog posts through the content source adapter", () => {
    const collection = loadBlogCollection(contentBlogSource);

    expect(contentBlogSource.name).toBe("content-blog");
    expect(collection.posts).toHaveLength(1);
    expect(collection.documents).toHaveLength(1);
  });

  it("sorts blog posts newest first", () => {
    const posts = getBlogPosts();

    expect(posts[0]?.slug).toBe("airjam-1-0");
  });

  it("resolves blog documents and static params from slugs", () => {
    expect(getBlogDocuments()).toHaveLength(1);
    expect(getBlogStaticParams()).toContainEqual({
      slug: "airjam-1-0",
    });
    expect(getBlogDocumentBySlug("airjam-1-0")?.post.title).toBe("Air Jam 1.0");
    expect(getBlogDocumentBySlug("missing")).toBeNull();
  });

  it("builds structured data for blog posts", () => {
    const post = getBlogPosts()[0];

    expect(post).toBeDefined();
    expect(buildBlogJsonLd(post!)).toMatchObject({
      "@type": "BlogPosting",
      headline: "Air Jam 1.0",
      author: {
        "@type": "Person",
        name: "Air Jam Team",
      },
    });
  });
});
