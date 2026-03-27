import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const migratingLegacyGamesDocsPage = defineDocsPage({
  title: "Migrating Legacy Games",
  href: "/docs/getting-started/migrating-legacy-games",
  description: "How to move older Air Jam games onto the current v1 app shape cleanly.",
  section: "Getting Started",
  icon: "layers",
  keywords: [
    "migration",
    "upgrade",
    "legacy",
    "AirJamProvider",
    "createAirJamApp",
    "createAirJamStore",
  ],
  docType: "migration",
  order: 4,
  stability: "evolving",
  audience: "user",
});

export const metadata = createDocsPageMetadata(
  migratingLegacyGamesDocsPage,
);
