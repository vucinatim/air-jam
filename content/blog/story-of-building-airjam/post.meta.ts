import { defineBlogPost } from "@/features/blog/metadata";

export const storyOfBuildingAirJamBlogPost = defineBlogPost({
  title: "Story of building Air Jam",
  summary:
    "Notes from building Air Jam, an open-source, phone-as-controller multiplayer arcade, and what the work taught me about where this category is going with LLMs in the loop.",
  publishedAt: "2026-05-03T12:00:00+02:00",
  author: "Tim Vučina",
  tags: ["origin-story", "framework", "ai-native", "platform"],
  published: true,
});

export const metadata = storyOfBuildingAirJamBlogPost;
