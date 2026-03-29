import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const projectStructureDocsPage = defineDocsPage({
  title: "Project Structure",
  href: "/docs/for-agents/project-structure",
  description:
    "Recommended file and boundary model for clean, testable Air Jam games.",
  section: "Agent Docs",
  icon: "layers",
  keywords: [
    "project structure",
    "architecture",
    "host",
    "controller",
    "domain",
    "engine",
    "adapters",
  ],
  docType: "agent",
  order: 1,
  stability: "evolving",
  audience: "agent",
  sinceVersion: "1.0.0",
  lastVerifiedVersion: "1.0.0",
});

export const metadata = createDocsPageMetadata(projectStructureDocsPage);
