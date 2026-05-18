// Dev.to syndication config for this article.
// Consumed by `pnpm run repo -- content blog export-devto every-phone-a-game-controller`.
// Articles that should NOT be cross-posted to dev.to simply omit this file.

import type { DevtoConfig } from "@/features/blog/devto-config";

export const devtoConfig: DevtoConfig = {
  // Title and description used in the dev.to YAML frontmatter. These can
  // differ from the canonical post.meta.ts (e.g. a punchier dev.to headline).
  title:
    "What If Every Phone in the Room Was a Game Controller (in the age of AI)?",
  description:
    "Building an open-source framework for the age of vibe-coded party games, and what nine developers built with it in seven hours.",
  // Lowercase, alphanumeric, max 4. Dev.to convention.
  tags: ["opensource", "react", "ai", "gamedev"],
  // Asset hosted on airjam.io. Dev.to renders the cover at ~1000x420.
  coverImage: "/blog-assets/every-phone-a-game-controller/cover.png",
  // Leave undefined to start as a dev.to draft. Set to true only when you
  // intend the generated file's frontmatter to mark the article as live.
  published: false,
};
