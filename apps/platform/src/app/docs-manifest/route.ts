import { getDocsManifestEntries } from "@/features/docs";

export function GET() {
  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      pages: getDocsManifestEntries(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    },
  );
}
