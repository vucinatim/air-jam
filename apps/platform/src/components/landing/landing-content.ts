export const landingCopy = {
  hero: {
    badge: "Free & open source",
    title: "Air Jam",
    subtitle: "Build multiplayer games. Phones are the controllers.",
    subtitles: [
      "Multiplayer games. Phones are the controllers.",
      "No downloads. No hardware. Scan and play.",
      "Your game, their phones, zero friction.",
      "Turn any screen into an arcade.",
      "Ship a game. Share a link. Fill a room.",
    ],
    primaryCta: {
      label: "Start building",
      href: "/docs/getting-started/quick-start",
    },
    secondaryCta: { label: "Try the arcade", href: "/arcade" },
  },
  coreLoop: {
    title: "Make. Join. Play. Repeat.",
    subtitle: `The whole point is one loop: <br/>
build something playable, get friends in fast, play it together, tweak it, and go again.`,
    steps: [
      {
        key: "make",
        icon: "terminal",
        title: "Make",
        body: "Start with one command, write your game logic, and let Air Jam handle the room, controllers, and networking.",
      },
      {
        key: "join",
        icon: "qr",
        title: "Join",
        body: "Players scan a QR code or tap a link. Their phone opens the right controller in the browser with no install friction.",
      },
      {
        key: "play",
        icon: "zap",
        title: "Play",
        body: "Inputs hit the big screen in real time, the room comes alive, and the payoff happens immediately.",
      },
    ],
  },
  batteries: {
    title: "Everything you need, out of the box",
    items: [
      {
        icon: "server",
        title: "Free public server",
        body: "No infra to manage. Your game connects to a hosted server automatically -- free for development and production.",
      },
      {
        icon: "qr",
        title: "Instant QR join",
        body: "Every room gets a QR code and shareable link. Players join in seconds from any phone browser.",
      },
      {
        icon: "arcade",
        title: "Publish to the Arcade",
        body: "Ship your game to the Arcade with one command. Players discover and play it instantly.",
      },
      {
        icon: "chart",
        title: "Built-in analytics",
        body: "Session counts, player metrics, and performance data from day one. No third-party setup.",
      },
      {
        icon: "bug",
        title: "Cross-device debugging",
        body: "Stream logs from every connected phone and the host into one unified view.",
      },
      {
        icon: "bot",
        title: "LLM-friendly by design",
        body: "Schema-driven APIs and typed contracts mean AI tools can read, generate, and modify your game code reliably.",
      },
    ],
  },
  gameShowcase: {
    title: "Built with Air Jam",
    subtitle: `Real games you can play right now. <br/>
Different genres, different controllers, same instant join.`,
    footerCta: { label: "Browse all games", href: "/arcade" },
  },
  sdkProofs: [
    {
      title: "One config, two surfaces",
      subtitle:
        "Define your input schema once. The host and every controller share the same typed contract.",
      footnote: "The docs cover the full host, controller, and store setup.",
      footnoteLink: {
        label: "Read the docs",
        href: "/docs/getting-started/introduction",
      },
      filename: "airjam.config.ts",
      layout: "textLeft" as const,
    },
    {
      title: "Shared state that just works",
      subtitle:
        "Create a store on the host, read it from any phone. Actions go through the host so the source of truth stays in one place.",
      footnote: "Full action contract and flow diagrams in the docs.",
      footnoteLink: {
        label: "Read the docs",
        href: "/docs/sdk/networked-state",
      },
      filename: "store.ts",
      layout: "codeLeft" as const,
    },
  ],
  whoFor: {
    title: "Who it's for",
    bullets: [
      {
        title: "Developers",
        body: "Typed APIs, predictable networking, and a clear host/controller model you can reason about.",
      },
      {
        title: "Tinkerers & vibe-coders",
        body: "Skip the infrastructure and get to a playable room with friends in minutes.",
      },
      {
        title: "First-time game makers",
        body: "Easy to start, no ceiling when you're ready to go deeper.",
      },
    ],
  },
  finalCta: {
    title: "Ready to build your first game?",
    subtitle:
      "Start with the docs, then jump into the arcade to see the kind of thing you can make.",
    primary: {
      label: "Open the docs",
      href: "/docs/getting-started/quick-start",
    },
    secondary: { label: "Enter arcade", href: "/arcade" },
  },
} as const;

export const storeSnippet = `import { createAirJamStore } from "@air-jam/sdk";

export const useGameStore = createAirJamStore((set) => ({
  score: 0,
  actions: {
    addPoint: (_ctx, { delta }) =>
      set((s) => ({ score: s.score + delta })),
  },
}));

const actions = useGameStore.useActions();
const score = useGameStore((s) => s.score);`;

export const sdkSnippet = `import { createAirJamApp, env } from "@air-jam/sdk";
import { z } from "zod";

const inputSchema = z.object({
  vector: z.object({ x: z.number(), y: z.number() }),
  action: z.boolean(),
});

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  game: { controllerPath: "/controller" },
  input: { schema: inputSchema },
});`;
