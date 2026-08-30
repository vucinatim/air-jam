import { defineBlogPost } from "@/features/blog/metadata";

export const wePutAirJamInACarBlogPost = defineBlogPost({
  title: "We Put Air Jam in a Car for a Road Trip",
  summary:
    "How Domen's Android Auto experiment became a one-day collaboration, a better music quiz, and a car full of friends playing Air Jam on the way to a celebration.",
  publishedAt: "2026-07-26T12:00:00+02:00",
  author: "Tim Vučina",
  tags: ["road-trip", "android-auto", "last-band-standing", "field-note"],
  coverImage: {
    src: "/blog-assets/we-put-airjam-in-a-car/cover-placeholder.svg",
    width: 1200,
    height: 630,
    alt: "Placeholder for Last Band Standing running on the display of Domen's BMW",
  },
  published: false,
});

export const metadata = wePutAirJamInACarBlogPost;
