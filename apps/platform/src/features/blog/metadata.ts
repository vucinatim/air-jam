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
  const coverImage = post.coverImage;
  const coverImageUrl = coverImage ? `${siteUrl}${coverImage.src}` : undefined;

  const openGraphImages = coverImage
    ? [
        {
          url: coverImageUrl as string,
          width: coverImage.width,
          height: coverImage.height,
          alt: coverImage.alt ?? post.title,
        },
      ]
    : undefined;

  const twitterImages = coverImageUrl ? [coverImageUrl] : undefined;

  return {
    title: post.title,
    description: post.summary,
    keywords: post.tags,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: post.title,
      description: post.summary,
      siteName: "Air Jam",
      publishedTime: post.publishedAt,
      authors: [post.author],
      tags: post.tags,
      ...(openGraphImages ? { images: openGraphImages } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary,
      ...(twitterImages ? { images: twitterImages } : {}),
    },
  };
}

export function buildBlogJsonLd(post: BlogPost) {
  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}${post.href}`;
  const coverImage = post.coverImage;
  const coverImageUrl = coverImage ? `${siteUrl}${coverImage.src}` : undefined;

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
    ...(coverImageUrl ? { image: coverImageUrl } : {}),
    publisher: {
      "@type": "Organization",
      name: "Air Jam",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/images/airjam-logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
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
