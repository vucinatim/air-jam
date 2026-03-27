import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const inputSystemDocsPage = defineDocsPage({
  title: "Input System",
  href: "/docs/sdk/input-system",
  description: "Input behavior modes, vectors, and button event handling.",
  section: "SDK",
  icon: "zap",
  keywords: ["input", "behavior", "vector", "button", "validation"],
  docType: "contract",
  order: 2,
  stability: "evolving",
  audience: "user",
});

export const metadata = createDocsPageMetadata(inputSystemDocsPage);
