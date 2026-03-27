import { defineBlogPost } from "@/features/blog/metadata";

export const airJamOneBlogPost = defineBlogPost({
  title: "Air Jam 1.0",
  summary:
    "The first public release of Air Jam: a cleaner SDK, a real platform, and a docs system that is finally shaped like a product surface instead of repo notes.",
  publishedAt: "2026-03-27T12:00:00+01:00",
  author: "Air Jam Team",
  tags: ["release", "platform", "sdk"],
  published: true,
});

export const metadata = airJamOneBlogPost;
