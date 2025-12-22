"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Code2,
  Cpu,
  FileText,
  Hash,
  Info,
  Layers,
  LucideIcon,
  Search,
  Zap,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

type DocsEntry = {
  title: string;
  page: string;
  section?: string;
  href: string;
  icon: LucideIcon;
  keywords: string[];
};

/**
 * Converts a heading to a URL-friendly slug/anchor
 */
const toSlug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const DOCS_ENTRIES: DocsEntry[] = [
  // === Introduction ===
  {
    title: "Introduction",
    page: "Getting Started",
    href: "/docs/getting-started/introduction",
    icon: Info,
    keywords: ["start", "begin", "overview", "air jam"],
  },
  {
    title: "Key Features",
    page: "Introduction",
    section: "Getting Started",
    href: "/docs/getting-started/introduction#key-features",
    icon: Hash,
    keywords: ["features", "zero app", "multiplayer", "type safe", "haptic"],
  },
  {
    title: "How It Works",
    page: "Introduction",
    section: "Getting Started",
    href: "/docs/getting-started/introduction#how-it-works",
    icon: Hash,
    keywords: ["diagram", "flow", "overview"],
  },
  {
    title: "Quick Start",
    page: "Introduction",
    section: "Getting Started",
    href: "/docs/getting-started/introduction#quick-start",
    icon: Hash,
    keywords: ["install", "setup", "pnpm", "npm", "sdk", "provider"],
  },

  // === Architecture ===
  {
    title: "Architecture",
    page: "Getting Started",
    href: "/docs/getting-started/architecture",
    icon: Layers,
    keywords: ["system", "overview", "monorepo", "components"],
  },
  {
    title: "System Overview",
    page: "Architecture",
    section: "Getting Started",
    href: "/docs/getting-started/architecture#system-overview",
    icon: Hash,
    keywords: ["diagram", "components", "structure"],
  },
  {
    title: "Platform Component",
    page: "Architecture",
    section: "Getting Started",
    href: "/docs/getting-started/architecture#1-platform-appsplatform",
    icon: Hash,
    keywords: ["next.js", "developer portal", "arcade", "catalog"],
  },
  {
    title: "Server Component",
    page: "Architecture",
    section: "Getting Started",
    href: "/docs/getting-started/architecture#2-server-packagesserver",
    icon: Hash,
    keywords: ["socket.io", "websocket", "real-time", "events"],
  },
  {
    title: "SDK Component",
    page: "Architecture",
    section: "Getting Started",
    href: "/docs/getting-started/architecture#3-sdk-packagessdk",
    icon: Hash,
    keywords: ["react", "hooks", "zustand", "provider"],
  },
  {
    title: "Run Modes",
    page: "Architecture",
    section: "Getting Started",
    href: "/docs/getting-started/architecture#run-modes",
    icon: Hash,
    keywords: ["standalone", "arcade", "bridge", "iframe"],
  },
  {
    title: "Data Flow",
    page: "Architecture",
    section: "Getting Started",
    href: "/docs/getting-started/architecture#data-flow",
    icon: Hash,
    keywords: ["input path", "signal path", "controller", "host"],
  },
  {
    title: "Security",
    page: "Architecture",
    section: "Getting Started",
    href: "/docs/getting-started/architecture#security",
    icon: Hash,
    keywords: ["api key", "authentication", "room isolation", "validation"],
  },

  // === Host System ===
  {
    title: "Host System",
    page: "How it Works",
    href: "/docs/how-it-works/host-system",
    icon: Cpu,
    keywords: ["host", "session", "room", "game"],
  },
  {
    title: "Standalone Host",
    page: "Host System",
    section: "How it Works",
    href: "/docs/how-it-works/host-system#standalone-host",
    icon: Hash,
    keywords: ["standalone", "direct", "websocket", "simple"],
  },
  {
    title: "Arcade Mode (Two-Host Model)",
    page: "Host System",
    section: "How it Works",
    href: "/docs/how-it-works/host-system#arcade-mode-two-host-model",
    icon: Hash,
    keywords: ["arcade", "iframe", "master", "child", "platform"],
  },
  {
    title: "Server-Authoritative Focus System",
    page: "Host System",
    section: "How it Works",
    href: "/docs/how-it-works/host-system#server-authoritative-focus-system",
    icon: Hash,
    keywords: ["focus", "authoritative", "security", "routing"],
  },
  {
    title: "Connection Flow",
    page: "Host System",
    section: "How it Works",
    href: "/docs/how-it-works/host-system#connection-flow",
    icon: Hash,
    keywords: ["launch", "join", "token", "flow", "sequence"],
  },
  {
    title: "Host Registration",
    page: "Host System",
    section: "How it Works",
    href: "/docs/how-it-works/host-system#host-registration",
    icon: Hash,
    keywords: ["register", "room", "code", "join"],
  },
  {
    title: "Player Management",
    page: "Host System",
    section: "How it Works",
    href: "/docs/how-it-works/host-system#player-management",
    icon: Hash,
    keywords: ["player", "join", "leave", "lifecycle", "spawn"],
  },
  {
    title: "State Broadcasting",
    page: "Host System",
    section: "How it Works",
    href: "/docs/how-it-works/host-system#state-broadcasting",
    icon: Hash,
    keywords: ["sendState", "broadcast", "message", "controllers"],
  },
  {
    title: "Error Handling",
    page: "Host System",
    section: "How it Works",
    href: "/docs/how-it-works/host-system#error-handling",
    icon: Hash,
    keywords: ["error", "reconnect", "disconnect", "status"],
  },

  // === Hooks ===
  {
    title: "SDK Hooks",
    page: "SDK",
    href: "/docs/sdk/hooks",
    icon: Code2,
    keywords: ["hooks", "api", "reference", "react"],
  },
  {
    title: "AirJamProvider",
    page: "Hooks",
    section: "SDK",
    href: "/docs/sdk/hooks#airjamprovider",
    icon: Hash,
    keywords: ["provider", "context", "config", "serverUrl", "apiKey"],
  },
  {
    title: "useAirJamHost",
    page: "Hooks",
    section: "SDK",
    href: "/docs/sdk/hooks#useairjamhost",
    icon: Hash,
    keywords: [
      "host",
      "room",
      "players",
      "getInput",
      "sendSignal",
      "onPlayerJoin",
    ],
  },
  {
    title: "useGetInput",
    page: "Hooks",
    section: "SDK",
    href: "/docs/sdk/hooks#usegetinput",
    icon: Hash,
    keywords: ["input", "lightweight", "performance", "no re-render"],
  },
  {
    title: "useSendSignal",
    page: "Hooks",
    section: "SDK",
    href: "/docs/sdk/hooks#usesendsignal",
    icon: Hash,
    keywords: ["signal", "haptic", "vibrate", "collision", "feedback"],
  },
  {
    title: "useAirJamController",
    page: "Hooks",
    section: "SDK",
    href: "/docs/sdk/hooks#useairjamcontroller",
    icon: Hash,
    keywords: [
      "controller",
      "mobile",
      "phone",
      "sendInput",
      "joystick",
      "button",
    ],
  },
  {
    title: "Utility Hooks",
    page: "Hooks",
    section: "SDK",
    href: "/docs/sdk/hooks#utility-hooks",
    icon: Hash,
    keywords: [
      "useAirJamContext",
      "useAirJamConfig",
      "useAirJamState",
      "useAirJamSocket",
    ],
  },
  {
    title: "Types",
    page: "Hooks",
    section: "SDK",
    href: "/docs/sdk/hooks#types",
    icon: Hash,
    keywords: [
      "PlayerProfile",
      "ConnectionStatus",
      "GameState",
      "HapticSignalPayload",
    ],
  },

  // === Input System ===
  {
    title: "Input System",
    page: "SDK",
    href: "/docs/sdk/input-system",
    icon: Zap,
    keywords: ["input", "latching", "validation", "schema"],
  },
  {
    title: "Input Flow",
    page: "Input System",
    section: "SDK",
    href: "/docs/sdk/input-system#input-flow",
    icon: Hash,
    keywords: ["flow", "diagram", "controller", "host"],
  },
  {
    title: "Configuration",
    page: "Input System",
    section: "SDK",
    href: "/docs/sdk/input-system#configuration",
    icon: Hash,
    keywords: ["config", "schema", "zod", "latch", "provider"],
  },
  {
    title: "Schema Validation",
    page: "Input System",
    section: "SDK",
    href: "/docs/sdk/input-system#schema-validation",
    icon: Hash,
    keywords: ["zod", "validate", "type", "runtime", "safety"],
  },
  {
    title: "Input Latching",
    page: "Input System",
    section: "SDK",
    href: "/docs/sdk/input-system#input-latching",
    icon: Hash,
    keywords: ["latch", "missed", "button", "tap", "frame"],
  },
  {
    title: "Boolean Latching",
    page: "Input System",
    section: "SDK",
    href: "/docs/sdk/input-system#boolean-latching",
    icon: Hash,
    keywords: ["boolean", "button", "trigger", "action", "true"],
  },
  {
    title: "Vector Latching",
    page: "Input System",
    section: "SDK",
    href: "/docs/sdk/input-system#vector-latching",
    icon: Hash,
    keywords: ["vector", "joystick", "stick", "directional", "flick"],
  },
  {
    title: "Reading Input",
    page: "Input System",
    section: "SDK",
    href: "/docs/sdk/input-system#reading-input",
    icon: Hash,
    keywords: ["read", "getInput", "useFrame", "game loop"],
  },
  {
    title: "Best Practices",
    page: "Input System",
    section: "SDK",
    href: "/docs/sdk/input-system#best-practices",
    icon: Hash,
    keywords: ["best", "practices", "tips", "performance", "lightweight"],
  },
  {
    title: "Debugging Input",
    page: "Input System",
    section: "SDK",
    href: "/docs/sdk/input-system#debugging-input",
    icon: Hash,
    keywords: ["debug", "console", "log", "visual", "troubleshoot"],
  },
  {
    title: "Common Issues",
    page: "Input System",
    section: "SDK",
    href: "/docs/sdk/input-system#common-issues",
    icon: Hash,
    keywords: ["issues", "problems", "not received", "laggy", "missed"],
  },
];

type DocsSearchProps = {
  variant?: "button" | "inline";
};

export const DocsSearch = ({ variant = "button" }: DocsSearchProps) => {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  const handleSelect = (href: string) => {
    runCommand(() => router.push(href));
  };

  // Group entries by whether they're pages or sections
  const pages = DOCS_ENTRIES.filter((e) => !e.section);
  const sections = DOCS_ENTRIES.filter((e) => e.section);

  return (
    <>
      <Button
        variant="outline"
        className={
          variant === "inline"
            ? "relative h-8 w-full justify-start rounded-md bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12"
            : "relative h-9 w-full justify-start gap-2 rounded-md bg-muted/50 pl-3 pr-2 text-sm font-normal text-muted-foreground shadow-none hover:bg-muted"
        }
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="hidden flex-1 text-left lg:inline-flex">
          Search docs...
        </span>
        <span className="flex-1 text-left lg:hidden">Search...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search Documentation"
        description="Search for pages and sections in the Air Jam documentation"
      >
        <CommandInput placeholder="Type to search..." />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Pages">
            {pages.map((entry) => (
              <CommandItem
                key={entry.href}
                value={`${entry.title} ${entry.page} ${entry.keywords.join(" ")}`}
                onSelect={() => handleSelect(entry.href)}
                className="flex items-center gap-3"
              >
                <entry.icon className="size-4 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{entry.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.page}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Sections">
            {sections.map((entry) => (
              <CommandItem
                key={entry.href}
                value={`${entry.title} ${entry.page} ${entry.section} ${entry.keywords.join(" ")}`}
                onSelect={() => handleSelect(entry.href)}
                className="flex items-center gap-3"
              >
                <Hash className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-0.5">
                  <span>{entry.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.section} → {entry.page}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};
