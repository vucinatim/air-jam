"use client";

import { Button } from "@/components/ui/button";
import {
  platformShellUtilityButtonClassName,
} from "@/components/shell-classes";
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
        className="overflow-hidden border-white/10 bg-zinc-950/96 text-white shadow-[0_28px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:max-w-sm"
        showCloseButton={false}
        data-testid="controller-fullscreen-prompt"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight text-white">
            Open controller in fullscreen?
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-white/62">
            Air Jam controllers work best fullscreen so buttons stay large and
            easy to hit from the couch.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex w-full flex-row flex-nowrap gap-3">
          <Button
            type="button"
            variant="outline"
            size="touch"
            className={`h-14 min-h-14 flex-1 rounded-2xl text-base ${platformShellUtilityButtonClassName}`}
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
            className="h-14 min-h-14 flex-1 rounded-2xl border border-white/10 bg-white text-base text-black hover:bg-white/92"
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
