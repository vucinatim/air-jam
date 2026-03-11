import { DOCS_PAGES } from "@/lib/docs-index";
import { getSiteUrl } from "@/lib/site-url";

function buildLlmsTxt() {
  const siteUrl = getSiteUrl();
  const lines = [
    "# Air Jam",
    "",
    "> Air Jam is a multiplayer game platform and SDK for QR-code-based phone controllers.",
    "",
    "## Preferred Docs",
    ...DOCS_PAGES.map(
      (page) => `- ${page.title}: ${siteUrl}${page.href} (${page.description})`,
    ),
    "",
    "## Machine-Readable Endpoints",
    `- Sitemap: ${siteUrl}/sitemap.xml`,
    `- Robots: ${siteUrl}/robots.txt`,
    "",
    "## Notes For Agents",
    "- Prefer docs pages over marketing pages for implementation details.",
    "- Code blocks are server-rendered in docs and intended for machine extraction.",
  ];

  return `${lines.join("\n")}\n`;
}

export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
