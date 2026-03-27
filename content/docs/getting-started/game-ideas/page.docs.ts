import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const gameIdeasDocsPage = defineDocsPage({
  title: "Game Ideas",
  href: "/docs/getting-started/game-ideas",
  description: "Inspiration and patterns for multiplayer game concepts.",
  section: "Getting Started",
  icon: "lightbulb",
  keywords: ["ideas", "examples", "patterns", "game design"],
  docType: "guide",
  order: 3,
  stability: "evolving",
  audience: "user",
});

export const metadata = createDocsPageMetadata(gameIdeasDocsPage);
