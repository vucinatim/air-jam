import type { JSX } from "react";
import { useEffect, useState } from "react";
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto pt-4">
          <pre className="bg-muted text-muted-foreground overflow-auto rounded-lg border p-4 font-mono text-xs">
            {jsonString}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
};
