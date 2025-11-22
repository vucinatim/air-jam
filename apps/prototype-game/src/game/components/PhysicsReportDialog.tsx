import { useState } from "react";
import type { PhysicsFrame } from "./PhysicsRecorder";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface PhysicsReportDialogProps {
  frames: PhysicsFrame[];
  onClose: () => void;
}

export function PhysicsReportDialog({
  frames,
  onClose,
}: PhysicsReportDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const data = JSON.stringify(frames, null, 2);
    navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Physics Report</DialogTitle>
          <DialogDescription>
            {frames.length} frames recorded. Copy this data to share with the
            developer.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          readOnly
          value={JSON.stringify(frames, null, 2)}
          className="flex-1 min-h-[400px] font-mono text-xs resize-none"
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={handleCopy}
            className={copied ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
