import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const quickStartDocsPage = defineDocsPage({
  title: "Quick Start",
  href: "/docs/getting-started/quick-start",
  description: "Set up and launch your first host.",
  section: "Getting Started",
  icon: "rocket",
  keywords: ["install", "setup", "host", "provider", "first game"],
  docType: "guide",
  order: 1,
  stability: "evolving",
  audience: "user",
});

export const metadata = createDocsPageMetadata(quickStartDocsPage);
