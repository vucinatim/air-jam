import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const architectureDocsPage = defineDocsPage({
  title: "Architecture",
  href: "/docs/how-it-works/architecture",
  description: "System architecture and service responsibilities.",
  section: "How it Works",
  icon: "layers",
  keywords: ["architecture", "system", "server", "sdk", "platform"],
  docType: "concept",
  order: 0,
  stability: "evolving",
  audience: "user",
});

export const metadata = createDocsPageMetadata(architectureDocsPage);
