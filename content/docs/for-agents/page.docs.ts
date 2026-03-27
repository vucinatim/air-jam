import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const forAgentsDocsPage = defineDocsPage({
  title: "For Agents",
  href: "/docs/for-agents",
  description: "Fast-entry index for LLM agents and automated tooling.",
  section: "Agent Docs",
  icon: "bot",
  keywords: ["llm", "agents", "automation", "index", "machine readable"],
  docType: "agent",
  order: 0,
  stability: "evolving",
  audience: "agent",
});

export const metadata = createDocsPageMetadata(forAgentsDocsPage);
