import { getSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  const publicAllow = [
    "/",
    "/blog",
    "/docs",
    "/llms.txt",
    "/docs-manifest",
    "/docs-search-index",
  ];
  const publicDisallow = ["/api/", "/dashboard/", "/arcade/", "/controller/"];

  const aiCrawlers = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "Applebot-Extended",
    "CCBot",
    "Bytespider",
    "DuckAssistBot",
    "Meta-ExternalAgent",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: publicAllow,
        disallow: publicDisallow,
      },
      ...aiCrawlers.map((userAgent) => ({
        userAgent,
        allow: publicAllow,
        disallow: publicDisallow,
      })),
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
