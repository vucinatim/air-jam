import { Check, Copy } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface DebugStateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  getState: () => unknown;
  title?: string;
  updateInterval?: number;
}

export const DebugStateDialog = ({
  isOpen,
  onClose,
  getState,
  title = "Debug State",
  updateInterval = 100,
}: DebugStateDialogProps): JSX.Element => {
  const [state, setState] = useState<unknown>(() => getState());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Update state periodically to see changes
    const interval = setInterval(() => {
      setState(getState());
    }, updateInterval);

    // Update immediately on mount
    const timeoutId = setTimeout(() => {
      setState(getState());
    }, 0);

    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
    };
  }, [isOpen, getState, updateInterval]);

  const jsonString = JSON.stringify(state, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="dark max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground">{title}</DialogTitle>
        </DialogHeader>
        <div className="relative flex-1 overflow-auto pt-4">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground absolute top-6 right-2 z-10"
            aria-label="Copy state"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <pre className="bg-muted text-muted-foreground overflow-auto rounded-lg border p-4 font-mono text-xs">
            {jsonString}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
};
