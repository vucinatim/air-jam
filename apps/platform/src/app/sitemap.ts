import { getBlogPosts } from "@/features/blog";
import { getDocsPages } from "@/features/docs";
import { getSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();
  const blogPosts = getBlogPosts();
  const docsPages = getDocsPages();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/docs`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  const blogPageEntries: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${siteUrl}${post.href}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const docsPageEntries: MetadataRoute.Sitemap = docsPages.map((page) => ({
    url: `${siteUrl}${page.href}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...blogPageEntries, ...docsPageEntries];
}
