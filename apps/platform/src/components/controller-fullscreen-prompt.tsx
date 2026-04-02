"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toggleDocumentFullscreen } from "@/lib/use-document-fullscreen";
import { Maximize } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ControllerFullscreenPromptProps {
  roomId: string | null;
  documentFullscreen: boolean;
}

export function ControllerFullscreenPrompt({
  roomId,
  documentFullscreen,
}: ControllerFullscreenPromptProps) {
  const [open, setOpen] = useState(false);
  const promptedRef = useRef(false);

  useEffect(() => {
    if (!roomId || documentFullscreen || promptedRef.current) {
      if (documentFullscreen) {
        setOpen(false);
      }
      return;
    }

    promptedRef.current = true;
    setOpen(true);
  }, [documentFullscreen, roomId]);

  const handleEnterFullscreen = useCallback(async () => {
    try {
      await toggleDocumentFullscreen();
    } finally {
      setOpen(false);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-sm"
        showCloseButton={false}
        data-testid="controller-fullscreen-prompt"
      >
        <DialogHeader>
          <DialogTitle>Open controller in fullscreen?</DialogTitle>
          <DialogDescription>
            Air Jam controllers work best fullscreen so buttons stay large and
            easy to hit from the couch.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            data-testid="controller-fullscreen-prompt-dismiss"
          >
            Not now
          </Button>
          <Button
            onClick={() => {
              void handleEnterFullscreen();
            }}
            data-testid="controller-fullscreen-prompt-enable"
          >
            <Maximize className="mr-2 h-4 w-4" />
            Go fullscreen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
