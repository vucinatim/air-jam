"use client";

import { Check, Copy } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Converts the page content to markdown format for LLM consumption
 */
const convertToMarkdown = (): string => {
  const prose = document.querySelector(".prose");
  if (!prose) return "";

  const lines: string[] = [];

  const processNode = (node: Element) => {
    const tagName = node.tagName.toLowerCase();
    const text = node.textContent?.trim() || "";

    // Check for figure description first (for diagrams and custom components)
    const figureDesc = node.getAttribute("data-figure-description");
    if (figureDesc) {
      lines.push(`\n> **[Figure]** ${figureDesc}\n`);
      return;
    }

    switch (tagName) {
      case "h1":
        lines.push(`# ${text}\n`);
        break;
      case "h2":
        lines.push(`\n## ${text}\n`);
        break;
      case "h3":
        lines.push(`\n### ${text}\n`);
        break;
      case "h4":
        lines.push(`\n#### ${text}\n`);
        break;
      case "p":
        if (text) lines.push(`${text}\n`);
        break;
      case "pre":
        const code = node.querySelector("code");
        const codeText = code?.textContent || text;
        const lang = code?.className?.match(/language-(\w+)/)?.[1] || "";
        lines.push(`\n\`\`\`${lang}\n${codeText}\n\`\`\`\n`);
        break;
      case "ul":
        Array.from(node.children).forEach((li) => {
          const liText = li.textContent?.trim() || "";
          if (liText) lines.push(`- ${liText}`);
        });
        lines.push("");
        break;
      case "ol":
        Array.from(node.children).forEach((li, i) => {
          const liText = li.textContent?.trim() || "";
          if (liText) lines.push(`${i + 1}. ${liText}`);
        });
        lines.push("");
        break;
      case "blockquote":
        lines.push(`> ${text}\n`);
        break;
      case "table":
        const rows = Array.from(node.querySelectorAll("tr"));
        rows.forEach((row, rowIndex) => {
          const cells = Array.from(row.querySelectorAll("th, td"));
          const cellTexts = cells.map((cell) => cell.textContent?.trim() || "");
          lines.push(`| ${cellTexts.join(" | ")} |`);
          if (rowIndex === 0) {
            lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
          }
        });
        lines.push("");
        break;
      case "hr":
        lines.push("\n---\n");
        break;
      default:
        // For container elements, process children
        if (["div", "section", "article", "main", "figure"].includes(tagName)) {
          Array.from(node.children).forEach(processNode);
        }
    }
  };

  Array.from(prose.children).forEach(processNode);

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export function TableOfContents() {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const pathname = usePathname();

  const handleCopy = useCallback(async () => {
    const markdown = convertToMarkdown();
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Reset active ID when pathname changes
    startTransition(() => {
      setActiveId("");
    });

    // Use a small delay to ensure DOM is updated after navigation
    const timeoutId = setTimeout(() => {
      const headings = Array.from(document.querySelectorAll("h2, h3"));
      const tocItems: TocItem[] = headings.map((heading) => ({
        id: heading.id,
        text: heading.textContent || "",
        level: parseInt(heading.tagName[1]),
      }));
      startTransition(() => {
        setItems(tocItems);
      });

      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveId(entry.target.id);
            }
          });
        },
        { rootMargin: "-100px 0px -66%" },
      );

      headings.forEach((heading) => observerRef.current?.observe(heading));
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [pathname]);

  if (items.length === 0) return null;

  return (
    <div className="hidden xl:block">
      <div className="sticky top-10 max-h-[calc(100vh-8rem)] w-full overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="w-full justify-start gap-2 text-xs"
          >
            {copied ? (
              <>
                <Check className="size-3.5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copy page as Markdown
              </>
            )}
          </Button>
          <div className="space-y-2">
            <p className="font-medium">On This Page</p>
            <ul className="m-0 list-none space-y-2.5 text-sm">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "hover:text-foreground text-muted-foreground line-clamp-1 transition-colors",
                    activeId === item.id && "text-foreground font-medium",
                    item.level === 3 && "pl-4",
                  )}
                >
                  <a href={`#${item.id}`}>{item.text}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
