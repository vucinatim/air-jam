import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const debuggingDocsPage = defineDocsPage({
  title: "Debugging and Logs",
  href: "/docs/getting-started/debugging",
  description: "Where to look when local Air Jam development is not behaving as expected.",
  section: "Getting Started",
  icon: "zap",
  keywords: ["debugging", "logs", "diagnostics", "troubleshooting", "dev"],
  docType: "guide",
  order: 2,
  stability: "evolving",
  audience: "user",
  sinceVersion: "1.0.0",
  lastVerifiedVersion: "1.0.0",
});

export const metadata = createDocsPageMetadata(debuggingDocsPage);
