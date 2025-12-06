/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ControllerShell, useAirJamShell } from "@air-jam/sdk";
import { ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// --- Components ---

/**
 * A D-Pad component that emits normalized vector inputs
 */
const DPad = ({
  onMove,
}: {
  onMove: (vector: { x: number; y: number }) => void;
}) => {
  // Simple 4-way D-Pad Logic
  const handleTouch = (
    direction: "up" | "down" | "left" | "right" | "none",
  ) => {
    switch (direction) {
      case "up":
        onMove({ x: 0, y: -1 });
        break;
      case "down":
        onMove({ x: 0, y: 1 });
        break;
      case "left":
        onMove({ x: -1, y: 0 });
        break;
      case "right":
        onMove({ x: 1, y: 0 });
        break;
      case "none":
        onMove({ x: 0, y: 0 });
        break;
    }
  };

  return (
    <div className="relative flex h-48 w-48 items-center justify-center rounded-full border-4 border-slate-700 bg-slate-800 shadow-inner select-none">
      {/* Up */}
      <div
        className="absolute top-2 left-1/2 h-16 w-12 -translate-x-1/2 cursor-pointer rounded-t-lg bg-slate-700 transition-colors hover:bg-slate-600 active:bg-blue-500"
        onTouchStart={(e) => {
          e.preventDefault();
          handleTouch("up");
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleTouch("none");
        }}
        onMouseDown={() => handleTouch("up")}
        onMouseUp={() => handleTouch("none")}
        onMouseLeave={() => handleTouch("none")}
      />
      {/* Down */}
      <div
        className="absolute bottom-2 left-1/2 h-16 w-12 -translate-x-1/2 cursor-pointer rounded-b-lg bg-slate-700 transition-colors hover:bg-slate-600 active:bg-blue-500"
        onTouchStart={(e) => {
          e.preventDefault();
          handleTouch("down");
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleTouch("none");
        }}
        onMouseDown={() => handleTouch("down")}
        onMouseUp={() => handleTouch("none")}
        onMouseLeave={() => handleTouch("none")}
      />
      {/* Left */}
      <div
        className="absolute top-1/2 left-2 h-12 w-16 -translate-y-1/2 cursor-pointer rounded-l-lg bg-slate-700 transition-colors hover:bg-slate-600 active:bg-blue-500"
        onTouchStart={(e) => {
          e.preventDefault();
          handleTouch("left");
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleTouch("none");
        }}
        onMouseDown={() => handleTouch("left")}
        onMouseUp={() => handleTouch("none")}
        onMouseLeave={() => handleTouch("none")}
      />
      {/* Right */}
      <div
        className="absolute top-1/2 right-2 h-12 w-16 -translate-y-1/2 cursor-pointer rounded-r-lg bg-slate-700 transition-colors hover:bg-slate-600 active:bg-blue-500"
        onTouchStart={(e) => {
          e.preventDefault();
          handleTouch("right");
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleTouch("none");
        }}
        onMouseDown={() => handleTouch("right")}
        onMouseUp={() => handleTouch("none")}
        onMouseLeave={() => handleTouch("none")}
      />
      {/* Center Pivot */}
      <div className="h-12 w-12 rounded-full bg-slate-900 shadow-inner" />
    </div>
  );
};

/**
 * A big action button
 */
const ActionButton = ({
  label,
  color = "red",
  onPress,
  onRelease,
}: {
  label: string;
  color?: "red" | "blue" | "green" | "yellow";
  onPress: () => void;
  onRelease: () => void;
}) => {
  const colorStyles = {
    red: "bg-red-500 active:bg-red-600 shadow-red-900",
    blue: "bg-blue-500 active:bg-blue-600 shadow-blue-900",
    green: "bg-green-500 active:bg-green-600 shadow-green-900",
    yellow: "bg-yellow-500 active:bg-yellow-600 shadow-yellow-900",
  };

  return (
    <button
      className={cn(
        "flex h-24 w-24 items-center justify-center rounded-full border-4 border-black/20 shadow-[0_4px_0_0] transition-all active:translate-y-1 active:shadow-none",
        colorStyles[color],
      )}
      onTouchStart={(e) => {
        e.preventDefault();
        onPress();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        onRelease();
      }}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
    >
      <span className="text-2xl font-bold text-white/90 drop-shadow-md">
        {label}
      </span>
    </button>
  );
};

const JoypadContent = dynamic(() => Promise.resolve(JoypadContentInner), {
  ssr: false,
});

export default function JoypadPage() {
  return <JoypadContent />;
}
function JoypadContentInner() {
  const router = useRouter();
  const shell = useAirJamShell({
    serverUrl: process.env.NEXT_PUBLIC_AIR_JAM_SERVER_URL,
  });
  const [vector, setVector] = useState({ x: 0, y: 0 });
  const [action, setAction] = useState(false);
  const [ability, setAbility] = useState(false);

  // Send input loop for Arcade Controller (approx 60fps)
  useEffect(() => {
    if (shell.connectionStatus !== "connected") return;
    // If we are in game mode (activeUrl is set), we don't send inputs from the shell d-pad
    if (shell.activeUrl) return;

    let animationFrameId: number;

    const loop = () => {
      // Send arbitrary input structure - this arcade controller uses vector/action/ability
      // Other games can define their own structure
      shell.sendInput({
        vector,
        action,
        ability,
        timestamp: Date.now(),
      });
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [shell.connectionStatus, vector, action, ability, shell, shell.activeUrl]);

  const handleReconnect = (roomCode: string) => {
    router.push(`?room=${roomCode}`);
  };

  const handleTogglePlayPause = () => {
    if (shell.connectionStatus !== "connected") return;

    shell.sendSystemCommand("toggle_pause");
  };

  // --- IFRAME LOGIC ---
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [, setIframeLoaded] = useState(false);

  // Reset state when activeUrl changes
  useEffect(() => {
    setIframeLoaded(false);
  }, [shell.activeUrl]);

  return (
    <ControllerShell
      connectionStatus={shell.connectionStatus}
      roomId={shell.roomId}
      gameState="playing" // Always show as playing for arcade shell
      onReconnect={handleReconnect}
      onTogglePlayPause={handleTogglePlayPause}
      onRefresh={() => window.location.reload()}
      requiredOrientation="landscape"
      customActions={
        shell.activeUrl ? (
          <Button
            type="button"
            variant="destructive"
            size="icon"
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
            className="h-full w-full border-none"
            allow="vibrate; gyroscope; accelerometer; autoplay; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
      )}

      {/* --- DEFAULT ARCADE CONTROLLER --- */}
      {!shell.activeUrl && (
        <>
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 opacity-20">
            <h1 className="text-3xl font-black tracking-tighter uppercase italic select-none">
              Air Jam <span className="text-primary">Arcade</span>
            </h1>
          </div>

          <div className="flex h-full w-full items-center justify-between px-12 pb-8">
            <div className="flex w-1/3 items-end justify-start">
              <DPad onMove={setVector} />
            </div>
            <div className="flex w-1/3 flex-col items-center justify-end gap-4 pb-8"></div>
            <div className="flex w-1/3 translate-y-4 rotate-6 transform items-center justify-end gap-6">
              <div className="translate-y-8">
                <ActionButton
                  label="B"
                  color="yellow"
                  onPress={() => setAbility(true)}
                  onRelease={() => setAbility(false)}
                />
              </div>
              <div className="-translate-y-8">
                <ActionButton
                  label="A"
                  color="red"
                  onPress={() => setAction(true)}
                  onRelease={() => setAction(false)}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </ControllerShell>
  );
}
