import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const hostSystemDocsPage = defineDocsPage({
  title: "Host System",
  href: "/docs/how-it-works/host-system",
  description: "Lifecycle of host sessions and player connections.",
  section: "How it Works",
  icon: "cpu",
  keywords: ["host", "room", "players", "connection", "session"],
  docType: "contract",
  order: 1,
  stability: "evolving",
  audience: "user",
});

export const metadata = createDocsPageMetadata(hostSystemDocsPage);
