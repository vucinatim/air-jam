// Dev.to syndication config for this article.
//
// Consumed by `pnpm run repo -- content blog export-devto every-phone-a-game-controller`.
// Articles that should NOT be cross-posted to dev.to simply omit this file.
//
// The shape is intentionally a plain object (no TS annotations, no imports)
// so the content-dir ESLint parser is happy and the exporter can load it
// from outside the platform's tsconfig scope. The platform-side type
// definition at apps/platform/src/features/blog/devto-config.ts (DevtoConfig)
// documents the shape; the exporter validates it at export time.

export const devtoConfig = {
  // Title and description used in the dev.to YAML frontmatter. These can
  // differ from the canonical post.meta.ts (e.g. a punchier dev.to headline).
  title:
    "What If Every Phone in the Room Was a Game Controller (in the age of AI)?",
  description:
    "Building an open-source framework for the age of vibe-coded party games, and what nine developers built with it in seven hours.",
  // Lowercase, alphanumeric, max 4. Dev.to convention.
  tags: ["opensource", "react", "ai", "gamedev"],
  // Asset under /blog-assets/<slug>/ or an absolute https URL. Dev.to displays at ~1000x420.
  coverImage: "/blog-assets/every-phone-a-game-controller/cover.png",
  // Leave false to start as a dev.to draft. Set true only when the generated
  // file's frontmatter should mark the article as live.
  published: false,
};
