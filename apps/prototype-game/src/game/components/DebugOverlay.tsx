import type React from "react";
import { useDebugStore } from "../debug-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bug, X } from "lucide-react";

interface DebugSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function DebugSection({
  title,
  children,
  className,
}: DebugSectionProps) {
  return (
    <div className={cn("border-b border-border/50 last:border-b-0", className)}>
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

interface DebugOverlayProps {
  children: React.ReactNode;
}

export function DebugOverlay({ children }: DebugOverlayProps) {
  const isOpen = useDebugStore((state) => state.isOpen);
  const toggle = useDebugStore((state) => state.toggle);

  return (
    <>
      {/* Toggle Button - Top Left */}
      <button
        onClick={toggle}
        className={cn(
          "fixed top-14 left-4 z-50",
          "size-10 rounded-md",
          "bg-background/90 border border-border",
          "flex items-center justify-center",
          "hover:bg-accent hover:text-accent-foreground",
          "transition-colors",
          "shadow-lg",
          "text-muted-foreground hover:text-foreground",
          isOpen && "hidden"
        )}
        aria-label="Toggle debug overlay"
        title="Toggle Debug Overlay"
      >
        <Bug />
      </button>

      {/* Sidebar Overlay */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full z-40 bg-background/40",
          "border-r border-border/50 rounded-r-2xl",
          "shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          "overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ width: "400px", maxWidth: "85vw" }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center justify-end">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggle}
                className="h-8 w-8 z-50"
                aria-label="Close debug overlay"
              >
                <X />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={toggle}
          aria-hidden="true"
        />
      )}
    </>
  );
}
