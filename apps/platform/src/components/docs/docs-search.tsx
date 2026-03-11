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
import { DOCS_SECTIONS, type DocsIcon } from "@/lib/docs-index";
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
  title: string;
  section: string;
  href: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
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

export const DocsSearch = ({ variant = "button" }: DocsSearchProps) => {
  const [open, setOpen] = useState(false);
  const [isMac] = useState(
    () =>
      typeof navigator !== "undefined" &&
      navigator.platform.toLowerCase().includes("mac"),
  );
  const router = useRouter();

  const entries = useMemo<DocsSearchEntry[]>(
    () =>
      DOCS_SECTIONS.flatMap((section) =>
        section.pages.map((page) => ({
          title: page.title,
          section: section.title,
          href: page.href,
          description: page.description,
          icon: ICONS[page.icon],
          keywords: page.keywords,
        })),
      ),
    [],
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
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{entry.title}</span>
                  <span className="text-muted-foreground text-xs">
                    {entry.section} · {entry.description}
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
