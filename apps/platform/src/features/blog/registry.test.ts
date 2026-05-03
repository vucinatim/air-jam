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
    expect(collection.posts).toHaveLength(2);
    expect(collection.documents).toHaveLength(2);
  });

  it("sorts blog posts newest first", () => {
    const posts = getBlogPosts();

    expect(posts.map((post) => post.slug)).toEqual([
      "story-of-building-airjam",
      "airjam-1-0",
    ]);
  });

  it("resolves blog documents and static params from slugs", () => {
    expect(getBlogDocuments()).toHaveLength(2);
    expect(getBlogStaticParams()).toContainEqual({
      slug: "airjam-1-0",
    });
    expect(getBlogStaticParams()).toContainEqual({
      slug: "story-of-building-airjam",
    });
    expect(getBlogDocumentBySlug("airjam-1-0")?.post.title).toBe("Air Jam 1.0");
    expect(getBlogDocumentBySlug("story-of-building-airjam")?.post.title).toBe(
      "Story of building Air Jam",
    );
    expect(getBlogDocumentBySlug("missing")).toBeNull();
  });

  it("builds structured data for blog posts", () => {
    const post = getBlogPosts().find((entry) => entry.slug === "airjam-1-0");

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
