import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Air Jam",
    short_name: "Air Jam",
    description:
      "Open-source framework for QR-code multiplayer party games. Scaffold with one command, deploy anywhere, play on any phone.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#00d3f3",
    icons: [
      {
        src: "/images/airjam-logo.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
