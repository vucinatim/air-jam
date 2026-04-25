"use client";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  getDocsSearchEntries,
  type DocsIcon,
  type DocsSearchEntry as FrameworkDocsSearchEntry,
} from "@/features/docs";
import {
  Bot,
  Code2,
  Cpu,
  Info,
  Layers,
  Lightbulb,
  LucideIcon,
  Network,
  Rocket,
  Search,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type DocsSearchProps = {
  variant?: "button" | "inline";
};

type DocsSearchEntry = {
  kind: "page" | "heading";
  title: string;
  section: string;
  href: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  pageTitle?: string;
  depth?: number;
};

const ICONS: Record<DocsIcon, LucideIcon> = {
  info: Info,
  rocket: Rocket,
  lightbulb: Lightbulb,
  layers: Layers,
  cpu: Cpu,
  code: Code2,
  zap: Zap,
  network: Network,
  bot: Bot,
};

/**
 * Whether to show Mac-style shortcuts (⌘) vs Ctrl, for UI hints only.
 * Prefers User-Agent Client Hints when available; falls back to `userAgent`.
 */
const isMacLikeKeyboardPlatform = (): boolean => {
  if (typeof navigator === "undefined") {
    return false;
  }
  const uaData = (
    navigator as Navigator & {
      userAgentData?: { platform?: string };
    }
  ).userAgentData;
  if (uaData?.platform !== undefined) {
    return uaData.platform === "macOS";
  }
  return /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
};

export const DocsSearch = ({ variant = "button" }: DocsSearchProps) => {
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const router = useRouter();
  const docsSearchEntries = getDocsSearchEntries();

  useEffect(() => {
    queueMicrotask(() => {
      setIsMac(isMacLikeKeyboardPlatform());
    });
  }, []);

  const entries = useMemo<DocsSearchEntry[]>(
    () =>
      docsSearchEntries.map((entry: FrameworkDocsSearchEntry) => ({
        kind: entry.kind,
        title: entry.title,
        section: entry.section,
        href: entry.href,
        description: entry.description,
        icon: ICONS[entry.icon],
        keywords: entry.keywords,
        pageTitle: entry.pageTitle,
        depth: entry.depth,
      })),
    [docsSearchEntries],
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  const handleSelect = useCallback(
    (href: string) => {
      runCommand(() => router.push(href));
    },
    [router, runCommand],
  );

  return (
    <>
      <Button
        variant="outline"
        className={
          variant === "inline"
            ? "bg-muted/50 text-muted-foreground relative h-8 w-full justify-start rounded-md text-sm font-normal shadow-none sm:pr-12"
            : "bg-muted/50 text-muted-foreground hover:bg-muted relative h-9 w-full justify-start gap-2 rounded-md pr-2 pl-3 text-sm font-normal shadow-none"
        }
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="hidden flex-1 text-left lg:inline-flex">
          Search docs...
        </span>
        <span className="flex-1 text-left lg:hidden">Search...</span>
        <kbd className="bg-muted pointer-events-none hidden h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex">
          <span className="text-xs">{isMac ? "⌘" : "Ctrl"}</span>K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search Documentation"
        description="Search for pages in the Air Jam documentation"
      >
        <CommandInput placeholder="Type to search..." />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Docs">
            {entries.map((entry) => (
              <CommandItem
                key={entry.href}
                value={`${entry.title} ${entry.section} ${entry.description} ${entry.keywords.join(" ")}`}
                onSelect={() => handleSelect(entry.href)}
                className="flex items-center gap-3"
              >
                <entry.icon className="size-4 shrink-0" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">
                    {entry.kind === "heading"
                      ? `# ${entry.title}`
                      : entry.title}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {entry.kind === "heading" && entry.pageTitle
                      ? `${entry.section} · ${entry.pageTitle}`
                      : `${entry.section} · ${entry.description}`}
                  </span>
                  {entry.kind === "heading" ? (
                    <span className="text-muted-foreground truncate text-xs">
                      {entry.description}
                    </span>
                  ) : null}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};
