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
      "every-phone-a-game-controller",
      "story-of-building-airjam",
    ]);
  });

  it("resolves blog documents and static params from slugs", () => {
    expect(getBlogDocuments()).toHaveLength(2);
    expect(getBlogStaticParams()).toContainEqual({
      slug: "every-phone-a-game-controller",
    });
    expect(getBlogStaticParams()).toContainEqual({
      slug: "story-of-building-airjam",
    });
    expect(getBlogDocumentBySlug("every-phone-a-game-controller")?.post.title).toBe(
      "What If Every Phone in the Room Was a Game Controller (in the age of AI)?",
    );
    expect(getBlogDocumentBySlug("story-of-building-airjam")?.post.title).toBe(
      "Story of building Air Jam",
    );
    expect(getBlogDocumentBySlug("missing")).toBeNull();
  });

  it("builds structured data for blog posts", () => {
    const post = getBlogPosts().find(
      (entry) => entry.slug === "story-of-building-airjam",
    );

    expect(post).toBeDefined();
    expect(buildBlogJsonLd(post!)).toMatchObject({
      "@type": "BlogPosting",
      headline: "Story of building Air Jam",
      author: {
        "@type": "Person",
        name: "Tim Vučina",
      },
    });
  });
});
