"use client";

import { usePathname } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents() {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const pathname = usePathname();

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
      <div className="sticky top-20">
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
  );
}
