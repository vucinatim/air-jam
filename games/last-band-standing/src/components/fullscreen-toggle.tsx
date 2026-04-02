import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export const FullscreenToggle = ({ className }: { className?: string }) => {
  const [isFullscreen, setIsFullscreen] = useState(
    () => Boolean(document.fullscreenElement),
  );

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggle = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen not supported or denied
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      className={cn("rounded-lg", className)}
    >
      {isFullscreen ? (
        <Minimize2 className="size-5" />
      ) : (
        <Maximize2 className="size-5" />
      )}
    </Button>
  );
};
