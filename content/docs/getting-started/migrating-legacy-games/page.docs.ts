import {
  createDocsPageMetadata,
  defineDocsPage,
} from "@/features/docs/metadata";

export const migratingLegacyGamesDocsPage = defineDocsPage({
  title: "Migrating Legacy Games",
  href: "/docs/getting-started/migrating-legacy-games",
  description:
    "How to move older Air Jam games onto the current v1 app shape cleanly.",
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
  order: 5,
  stability: "evolving",
  audience: "user",
  sinceVersion: "1.0.0",
  lastVerifiedVersion: "1.0.0",
});

export const metadata = createDocsPageMetadata(migratingLegacyGamesDocsPage);
