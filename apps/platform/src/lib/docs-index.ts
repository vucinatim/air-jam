export type DocsIcon =
  | "info"
  | "rocket"
  | "lightbulb"
  | "layers"
  | "cpu"
  | "code"
  | "zap"
  | "network"
  | "bot";

export interface DocsPageEntry {
  title: string;
  href: `/docs/${string}`;
  description: string;
  icon: DocsIcon;
  keywords: string[];
}

export interface DocsSection {
  title: string;
  pages: DocsPageEntry[];
}

export const DOCS_SECTIONS: DocsSection[] = [
  {
    title: "Getting Started",
    pages: [
      {
        title: "Introduction",
        href: "/docs/getting-started/introduction",
        description: "Overview of Air Jam and core concepts.",
        icon: "info",
        keywords: [
          "getting started",
          "overview",
          "multiplayer",
          "qr code",
          "controller",
        ],
      },
      {
        title: "Quick Start",
        href: "/docs/getting-started/quick-start",
        description: "Set up and launch your first host.",
        icon: "rocket",
        keywords: ["install", "setup", "host", "provider", "first game"],
      },
      {
        title: "Game Ideas",
        href: "/docs/getting-started/game-ideas",
        description: "Inspiration and patterns for multiplayer game concepts.",
        icon: "lightbulb",
        keywords: ["ideas", "examples", "patterns", "game design"],
      },
    ],
  },
  {
    title: "How it Works",
    pages: [
      {
        title: "Architecture",
        href: "/docs/how-it-works/architecture",
        description: "System architecture and service responsibilities.",
        icon: "layers",
        keywords: ["architecture", "system", "server", "sdk", "platform"],
      },
      {
        title: "Host System",
        href: "/docs/how-it-works/host-system",
        description: "Lifecycle of host sessions and player connections.",
        icon: "cpu",
        keywords: ["host", "room", "players", "connection", "session"],
      },
    ],
  },
  {
    title: "SDK",
    pages: [
      {
        title: "Hooks",
        href: "/docs/sdk/hooks",
        description: "React hooks API reference for host and controller state.",
        icon: "code",
        keywords: ["hooks", "api", "reference", "react", "host", "controller"],
      },
      {
        title: "Input System",
        href: "/docs/sdk/input-system",
        description: "Input latching, vectors, and button event handling.",
        icon: "zap",
        keywords: ["input", "latching", "vector", "button", "validation"],
      },
      {
        title: "Networked State",
        href: "/docs/sdk/networked-state",
        description: "Synchronizing shared state between host and controllers.",
        icon: "network",
        keywords: ["networked state", "sync", "zustand", "store", "broadcast"],
      },
    ],
  },
  {
    title: "Agent Docs",
    pages: [
      {
        title: "For Agents",
        href: "/docs/for-agents",
        description: "Fast-entry index for LLM agents and automated tooling.",
        icon: "bot",
        keywords: ["llm", "agents", "automation", "index", "machine readable"],
      },
    ],
  },
];

export const DOCS_PAGES: DocsPageEntry[] = DOCS_SECTIONS.flatMap(
  (section) => section.pages,
);
