import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const devLogsDocsPage = defineDocsPage({
  title: "Unified Dev Logs",
  href: "/docs/getting-started/dev-logs",
  description:
    "How to use Air Jam's canonical local observability stream for server, host, controller, and runtime debugging.",
  section: "Getting Started",
  icon: "network",
  keywords: [
    "dev logs",
    "observability",
    "traceId",
    "debugging",
    "controller",
    "host",
    "server",
  ],
  docType: "guide",
  order: 3,
  stability: "evolving",
  audience: "user",
});

export const metadata = createDocsPageMetadata(devLogsDocsPage);
