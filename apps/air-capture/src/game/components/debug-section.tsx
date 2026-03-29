import { cn } from "@/lib/utils";
import type React from "react";

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
