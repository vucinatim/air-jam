import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const stateAndRenderingDocsPage = defineDocsPage({
  title: "State and Rendering",
  href: "/docs/for-agents/state-and-rendering",
  description:
    "State ownership and rendering rules for React, Zustand, R3F, and per-frame gameplay code.",
  section: "Agent Docs",
  icon: "cpu",
  keywords: [
    "state",
    "rendering",
    "zustand",
    "react",
    "r3f",
    "refs",
    "performance",
  ],
  docType: "agent",
  order: 3,
  stability: "evolving",
  audience: "agent",
});

export const metadata = createDocsPageMetadata(stateAndRenderingDocsPage);
