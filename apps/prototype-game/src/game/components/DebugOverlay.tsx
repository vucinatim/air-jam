import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bug, X } from "lucide-react";
import type React from "react";
import { useDebugStore } from "../debug-store";

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
    <div className={cn("border-border/50 border-b last:border-b-0", className)}>
      <div className="px-4 py-3">
        <h3 className="text-foreground text-sm font-semibold">{title}</h3>
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
          "bg-background/90 border-border border",
          "flex items-center justify-center",
          "hover:bg-accent hover:text-accent-foreground",
          "transition-colors",
          "shadow-lg",
          "text-muted-foreground hover:text-foreground",
          isOpen && "hidden",
        )}
        aria-label="Toggle debug overlay"
        title="Toggle Debug Overlay"
      >
        <Bug />
      </button>

      {/* Sidebar Overlay */}
      <div
        className={cn(
          "bg-background/40 fixed top-0 left-0 z-40 h-full",
          "border-border/50 rounded-r-2xl border-r",
          "shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          "overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ width: "400px", maxWidth: "85vw" }}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-border border-b px-4 py-4">
            <div className="flex items-center justify-end">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggle}
                className="z-50 h-8 w-8"
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
