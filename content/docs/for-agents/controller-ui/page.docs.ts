import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const controllerUiDocsPage = defineDocsPage({
  title: "Controller UI",
  href: "/docs/for-agents/controller-ui",
  description:
    "Touch-first rules for building controller interfaces that feel like game controls instead of generic web apps.",
  section: "Agent Docs",
  icon: "zap",
  keywords: [
    "controller ui",
    "touch",
    "mobile",
    "controls",
    "layout",
    "gamepad",
  ],
  docType: "agent",
  order: 2,
  stability: "evolving",
  audience: "agent",
  sinceVersion: "1.0.0",
  lastVerifiedVersion: "1.0.0",
});

export const metadata = createDocsPageMetadata(controllerUiDocsPage);
