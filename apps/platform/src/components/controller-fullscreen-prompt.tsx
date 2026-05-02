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
  portalContainer?: HTMLElement | null;
}

export function ControllerFullscreenPrompt({
  roomId,
  documentFullscreen,
  portalContainer,
}: ControllerFullscreenPromptProps) {
  const [open, setOpen] = useState(false);
  const acknowledgedRef = useRef(false);

  useEffect(() => {
    if (!roomId) {
      setOpen(false);
      return;
    }

    if (documentFullscreen) {
      acknowledgedRef.current = true;
      setOpen(false);
      return;
    }

    if (acknowledgedRef.current) {
      return;
    }

    acknowledgedRef.current = true;
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
        portalContainer={portalContainer}
        data-testid="controller-fullscreen-prompt"
      >
        <DialogHeader>
          <DialogTitle>Open controller in fullscreen?</DialogTitle>
          <DialogDescription>
            Air Jam controllers work best fullscreen so buttons stay large and
            easy to hit from the couch.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex w-full flex-row flex-nowrap gap-3">
          <Button
            type="button"
            variant="outline"
            size="touch"
            className="h-14 min-h-14 flex-1 rounded-xl text-base"
            onClick={() => {
              acknowledgedRef.current = true;
              setOpen(false);
            }}
            data-testid="controller-fullscreen-prompt-dismiss"
          >
            Not now
          </Button>
          <Button
            type="button"
            size="touch"
            className="h-14 min-h-14 flex-1 rounded-xl text-base"
            onClick={() => {
              void handleEnterFullscreen();
            }}
            data-testid="controller-fullscreen-prompt-enable"
          >
            <Maximize className="size-5 shrink-0" />
            Go fullscreen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
