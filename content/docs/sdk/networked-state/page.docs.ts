import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const networkedStateDocsPage = defineDocsPage({
  title: "Networked State",
  href: "/docs/sdk/networked-state",
  description: "Synchronizing shared state between host and controllers.",
  section: "SDK",
  icon: "network",
  keywords: ["networked state", "sync", "zustand", "store", "broadcast"],
  docType: "reference",
  order: 3,
  stability: "evolving",
  audience: "user",
});

export const metadata = createDocsPageMetadata(networkedStateDocsPage);
