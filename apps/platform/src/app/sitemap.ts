import { DOCS_PAGES } from "@/lib/docs-index";
import { getSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/docs`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  const docsPages: MetadataRoute.Sitemap = DOCS_PAGES.map((page) => ({
    url: `${siteUrl}${page.href}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...docsPages];
}
