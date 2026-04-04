import { buildLlmsTxt } from "@/features/docs";
import { getSiteUrl } from "@/lib/site-url";

export function GET() {
  return new Response(buildLlmsTxt(getSiteUrl()), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
