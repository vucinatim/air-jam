/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { RemoteDPad } from "@/components/remote-d-pad";
import { Button } from "@/components/ui/button";
import { AirJamProvider, ControllerShell, useAirJamShell } from "@air-jam/sdk";
import { ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const ControllerContent = dynamic(
  () => Promise.resolve(ControllerContentInner),
  {
    ssr: false,
  },
);

export default function ControllerPage() {
  return (
    <AirJamProvider>
      <ControllerContent />
    </AirJamProvider>
  );
}
function ControllerContentInner() {
  const shell = useAirJamShell();

  // Use refs to store input state - avoids re-renders and keeps loop stable
  const vectorRef = useRef({ x: 0, y: 0 });
  const actionRef = useRef(false);
  const lastLoopFailLogRef = useRef(0);

  // Send input loop for Arcade Controller (approx 60fps)
  // Using refs means this effect only runs once when connection status changes
  useEffect(() => {
    if (shell.connectionStatus !== "connected") return;
    // If we are in game mode (activeUrl is set), we don't send inputs from the shell d-pad
    if (shell.activeUrl) return;

    let animationFrameId: number;

    const loop = () => {
      // Read from refs - always gets latest values without causing re-renders
      const inputResult = shell.sendInput({
        vector: vectorRef.current,
        action: actionRef.current,
        timestamp: Date.now(),
      });
      // Log throttled failures
      const now = Date.now();
      if (
        !inputResult &&
        (!lastLoopFailLogRef.current || now - lastLoopFailLogRef.current > 1000)
      ) {
        lastLoopFailLogRef.current = now;
        fetch(
          "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "controller/page.tsx:42",
              message: "sendInput returned false in loop",
              data: {
                activeUrl: shell.activeUrl,
                connectionStatus: shell.connectionStatus,
              },
              timestamp: now,
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "H3",
            }),
          },
        ).catch(() => {});
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [shell.connectionStatus, shell, shell.activeUrl]);

  // --- IFRAME LOGIC ---
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [, setIframeLoaded] = useState(false);

  // Reset ALL state when activeUrl changes (prevents stale input causing game relaunch)
  useEffect(() => {
    setIframeLoaded(false);
    // Reset input refs to prevent ghost inputs when switching between arcade and game
    vectorRef.current = { x: 0, y: 0 };
    actionRef.current = false;
  }, [shell.activeUrl]);

  console.log("shell.gameState", shell.gameState);

  return (
    <ControllerShell
      forceOrientation={shell.activeUrl ? undefined : "portrait"}
      customActions={
        shell.activeUrl ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="border-red-500 hover:border-red-600"
            onClick={() => {
              if (confirm("Exit game and return to arcade?")) {
                shell.sendSystemCommand("exit");
              }
            }}
            aria-label="Exit game"
            title="Exit game"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : null
      }
    >
      {/* --- CHILD GAME CONTROLLER --- */}
      {shell.activeUrl && (
        <div className="bg-background absolute inset-0 z-40">
          <iframe
            ref={iframeRef}
            src={`${shell.activeUrl}${
              shell.activeUrl.includes("?") ? "&" : "?"
            }airjam_mode=child&airjam_force_connect=true&aj_controller_id=${
              shell.controllerId
            }&aj_room=${shell.roomId}`}
            className="h-full w-full border-none bg-black"
            style={{ backgroundColor: "#000000" }}
            allow="vibrate; gyroscope; accelerometer; autoplay; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
      )}

      {/* --- DEFAULT ARCADE CONTROLLER --- */}
      {!shell.activeUrl && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-6 py-12">
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
    </ControllerShell>
  );
}
