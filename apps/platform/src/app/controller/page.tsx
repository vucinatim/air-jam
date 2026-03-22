/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { RemoteDPad } from "@/components/remote-d-pad";
import { Button } from "@/components/ui/button";
import { platformControllerSessionConfig } from "@/lib/airjam-session-config";
import {
  appendRuntimeQueryParams,
  ControllerSessionProvider,
  normalizeRuntimeUrl,
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";
import { ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

const ControllerContent = dynamic(
  () => Promise.resolve(ControllerContentInner),
  {
    ssr: false,
  },
);

export default function ControllerPage() {
  return (
    <ControllerSessionProvider {...platformControllerSessionConfig}>
      <ControllerContent />
    </ControllerSessionProvider>
  );
}
function ControllerContentInner() {
  const controller = useAirJamController();
  const writeInput = useInputWriter();
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [isPortrait, setIsPortrait] = useState(true);

  // Use refs to store input state - avoids re-renders and keeps loop stable
  const vectorRef = useRef({ x: 0, y: 0 });
  const actionRef = useRef(false);
  const lastLoopFailLogRef = useRef(0);

  useEffect(() => {
    if (!controller.socket) return;

    const handleLoadUi = (payload: { url: string }) => {
      const normalized = normalizeRuntimeUrl(payload.url);
      if (!normalized) {
        console.warn("[Controller] Blocked client:loadUi with invalid URL", {
          url: payload.url,
        });
        setActiveUrl(null);
        return;
      }
      setActiveUrl(normalized);
    };
    const handleUnloadUi = () => {
      setActiveUrl(null);
    };
    const handleDisconnect = () => {
      setActiveUrl(null);
    };

    controller.socket.on("client:loadUi", handleLoadUi);
    controller.socket.on("client:unloadUi", handleUnloadUi);
    controller.socket.on("disconnect", handleDisconnect);
    return () => {
      controller.socket?.off("client:loadUi", handleLoadUi);
      controller.socket?.off("client:unloadUi", handleUnloadUi);
      controller.socket?.off("disconnect", handleDisconnect);
    };
  }, [controller.socket]);

  // Canonical controller loop: fixed-cadence input publishing.
  useControllerTick(
    () => {
      const inputResult = writeInput({
        vector: vectorRef.current,
        action: actionRef.current,
        timestamp: Date.now(),
      });

      const now = Date.now();
      if (
        !inputResult &&
        (!lastLoopFailLogRef.current || now - lastLoopFailLogRef.current > 1000)
      ) {
        lastLoopFailLogRef.current = now;
      }
    },
    {
      enabled: controller.connectionStatus === "connected" && !activeUrl,
      intervalMs: 16,
    },
  );

  // --- IFRAME LOGIC ---
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [, setIframeLoaded] = useState(false);
  const controllerIframeSrc = useMemo(() => {
    if (!activeUrl || !controller.controllerId || !controller.roomId) {
      return null;
    }

    return appendRuntimeQueryParams(activeUrl, {
      aj_controller_id: controller.controllerId,
      aj_room: controller.roomId,
    });
  }, [activeUrl, controller.controllerId, controller.roomId]);

  // Reset ALL state when activeUrl changes (prevents stale input causing game relaunch)
  useEffect(() => {
    setIframeLoaded(false);
    // Reset input refs to prevent ghost inputs when switching between arcade and game
    vectorRef.current = { x: 0, y: 0 };
    actionRef.current = false;
  }, [activeUrl]);

  // Keep default controller in portrait only.
  useEffect(() => {
    if (activeUrl) {
      setIsPortrait(true);
      return;
    }

    const media = window.matchMedia("(orientation: portrait)");
    const handleChange = () => setIsPortrait(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [activeUrl]);

  const statusDotClass =
    controller.connectionStatus === "connected"
      ? "bg-emerald-400"
      : controller.connectionStatus === "connecting" ||
          controller.connectionStatus === "reconnecting"
        ? "bg-amber-300"
        : "bg-rose-400";

  return (
    <div className="dark">
      <div className="text-foreground relative flex h-dvh w-dvw touch-none flex-col overflow-hidden bg-black select-none">
        <header className="sticky top-0 z-50 flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`} />
            <div>
              <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                Room
              </p>
              <p className="text-lg leading-tight font-semibold">
                {controller.roomId ?? "N/A"}
              </p>
            </div>
          </div>
          {activeUrl ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-red-500 hover:border-red-600"
              onClick={() => {
                if (confirm("Exit game and return to arcade?")) {
                  controller.sendSystemCommand("exit");
                }
              }}
              aria-label="Exit game"
              title="Exit game"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <p className="text-muted-foreground text-xs uppercase">
              {controller.connectionStatus}
            </p>
          )}
        </header>

        <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 sm:p-4">
          {!isPortrait && !activeUrl && (
            <div className="bg-background/95 absolute inset-0 z-30 flex flex-col items-center justify-center px-6 text-center backdrop-blur-sm">
              <p className="text-xl font-semibold">Rotate your device</p>
              <p className="text-muted-foreground mt-2 text-sm">
                The default arcade controller is portrait-only.
              </p>
            </div>
          )}

          {/* --- CHILD GAME CONTROLLER --- */}
          {activeUrl && (
            <div className="bg-background absolute inset-0 z-20">
              {controllerIframeSrc ? (
                <iframe
                  ref={iframeRef}
                  src={controllerIframeSrc}
                  className="h-full w-full border-none bg-black"
                  style={{ backgroundColor: "#000000" }}
                  allow="vibrate; gyroscope; accelerometer; autoplay; fullscreen"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
                  onLoad={() => setIframeLoaded(true)}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    Unable to load game controller UI due to invalid runtime URL.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* --- DEFAULT ARCADE CONTROLLER --- */}
          {!activeUrl && (
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-8 px-6 py-12">
              <div className="text-center opacity-30">
                <h1 className="text-4xl font-black tracking-tighter uppercase select-none">
                  Air Jam
                </h1>
                <p className="text-primary text-2xl font-black tracking-wider uppercase">
                  Arcade
                </p>
              </div>

              <div className="flex flex-1 items-center justify-center">
                <RemoteDPad
                  onMove={(vector) => {
                    vectorRef.current = vector;
                  }}
                  onConfirm={() => {
                    actionRef.current = true;
                  }}
                  onConfirmRelease={() => {
                    actionRef.current = false;
                  }}
                />
              </div>

              <div className="text-muted-foreground text-center text-sm opacity-50">
                <p>Use the remote to navigate</p>
                <p className="mt-1">Press OK to select</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
