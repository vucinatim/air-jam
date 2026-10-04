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

const ACKNOWLEDGEMENT_KEY = "airjam:controller-fullscreen-acknowledged";

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

  const acknowledge = useCallback(() => {
    acknowledgedRef.current = true;
    try {
      window.sessionStorage.setItem(ACKNOWLEDGEMENT_KEY, "1");
    } catch {
      // Storage restrictions must never prevent controller use. The ref still
      // remembers the choice while this controller remains mounted.
    }
  }, []);

  const dismiss = useCallback(() => {
    acknowledge();
    setOpen(false);
  }, [acknowledge]);

  // Resolve browser-only session acknowledgement after hydration; the server
  // and first client render both keep the dialog closed.
  /* eslint-disable react-hooks/set-state-in-effect -- Synchronize this dialog with browser-only session storage after mount. */
  useEffect(() => {
    if (!roomId) {
      setOpen(false);
      return;
    }

    if (documentFullscreen) {
      acknowledge();
      setOpen(false);
      return;
    }

    try {
      if (window.sessionStorage.getItem(ACKNOWLEDGEMENT_KEY) === "1") {
        acknowledgedRef.current = true;
        setOpen(false);
        return;
      }
    } catch {
      // Browser-only storage is read after mount, never during SSR/hydration.
    }

    if (acknowledgedRef.current) {
      return;
    }

    acknowledgedRef.current = true;
    setOpen(true);
  }, [acknowledge, documentFullscreen, roomId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleEnterFullscreen = useCallback(async () => {
    dismiss();
    try {
      await toggleDocumentFullscreen();
    } catch {
      // Fullscreen may be denied or unsupported; ordinary play still works.
    }
  }, [dismiss]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setOpen(true);
        else dismiss();
      }}
    >
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
            onClick={dismiss}
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
