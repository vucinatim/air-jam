import { getSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";

import {
  blogPostDefinitionSchema,
  blogPostSchema,
  type BlogPost,
  type BlogPostDefinition,
} from "./schema";

export function defineBlogPost(
  post: BlogPostDefinition,
): Readonly<BlogPostDefinition> {
  return blogPostDefinitionSchema.parse(post);
}

export function createBlogPostMetadata(post: BlogPost): Metadata {
  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}${post.href}`;

  return {
    title: `${post.title} | Air Jam Blog`,
    description: post.summary,
    keywords: post.tags,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: `${post.title} | Air Jam Blog`,
      description: post.summary,
      siteName: "Air Jam",
      publishedTime: post.publishedAt,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: `${post.title} | Air Jam Blog`,
      description: post.summary,
    },
  };
}

export function buildBlogJsonLd(post: BlogPost) {
  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}${post.href}`;

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    url: canonicalUrl,
    datePublished: post.publishedAt,
    author: {
      "@type": "Person",
      name: post.author,
    },
    keywords: post.tags,
    publisher: {
      "@type": "Organization",
      name: "Air Jam",
      url: siteUrl,
    },
  };
}

export function hydrateBlogPost(
  definition: BlogPostDefinition,
  slug: string,
): BlogPost {
  return blogPostSchema.parse({
    ...definition,
    slug,
    href: `/blog/${slug}`,
  });
}
