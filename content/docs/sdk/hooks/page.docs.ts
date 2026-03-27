import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const hooksDocsPage = defineDocsPage({
  title: "Hooks",
  href: "/docs/sdk/hooks",
  description: "React hooks API reference for host and controller state.",
  section: "SDK",
  icon: "code",
  keywords: ["hooks", "api", "reference", "react", "host", "controller"],
  docType: "reference",
  order: 0,
  stability: "evolving",
  audience: "user",
});

export const metadata = createDocsPageMetadata(hooksDocsPage);
