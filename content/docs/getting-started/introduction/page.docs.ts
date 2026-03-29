import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const introductionDocsPage = defineDocsPage({
  title: "Introduction",
  href: "/docs/getting-started/introduction",
  description: "Overview of Air Jam and core concepts.",
  section: "Getting Started",
  icon: "info",
  keywords: [
    "getting started",
    "overview",
    "multiplayer",
    "qr code",
    "controller",
  ],
  docType: "concept",
  order: 0,
  stability: "evolving",
  audience: "user",
  sinceVersion: "1.0.0",
  lastVerifiedVersion: "1.0.0",
});

export const metadata = createDocsPageMetadata(introductionDocsPage);
