import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const uiComponentsDocsPage = defineDocsPage({
  title: "UI Components",
  href: "/docs/sdk/ui-components",
  description:
    "Canonical reusable UI components from @air-jam/sdk/ui with usage examples.",
  section: "SDK",
  icon: "code",
  keywords: [
    "ui",
    "components",
    "qr code",
    "avatar",
    "orientation",
    "volume",
    "button",
    "slider",
  ],
  docType: "reference",
  order: 1,
  stability: "evolving",
  audience: "user",
});

export const metadata = createDocsPageMetadata(uiComponentsDocsPage);
