/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAirJamShell, ControllerShell } from "@air-jam/sdk";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

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
    direction: "up" | "down" | "left" | "right" | "none"
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
    <div className="relative w-48 h-48 bg-slate-800 rounded-full shadow-inner border-4 border-slate-700 flex items-center justify-center select-none">
      {/* Up */}
      <div
        className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-16 bg-slate-700 hover:bg-slate-600 active:bg-blue-500 rounded-t-lg cursor-pointer transition-colors"
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
        className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-16 bg-slate-700 hover:bg-slate-600 active:bg-blue-500 rounded-b-lg cursor-pointer transition-colors"
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
        className="absolute left-2 top-1/2 -translate-y-1/2 h-12 w-16 bg-slate-700 hover:bg-slate-600 active:bg-blue-500 rounded-l-lg cursor-pointer transition-colors"
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
        className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-16 bg-slate-700 hover:bg-slate-600 active:bg-blue-500 rounded-r-lg cursor-pointer transition-colors"
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
      <div className="w-12 h-12 bg-slate-900 rounded-full shadow-inner" />
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
        "w-24 h-24 rounded-full shadow-[0_4px_0_0] active:shadow-none active:translate-y-1 transition-all flex items-center justify-center border-4 border-black/20",
        colorStyles[color]
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
  const shell = useAirJamShell();
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
      shell.sendInput({
        vector,
        action,
        ability,
        timestamp: Date.now(),
        togglePlayPause: false, 
      });
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [shell.connectionStatus, vector, action, ability, shell, shell.activeUrl]);

  const handleReconnect = (roomCode: string) => {
    router.push(`?room=${roomCode}`);
  };

  // --- IFRAME LOGIC ---
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Reset state when activeUrl changes
  useEffect(() => {
    setIframeLoaded(false);
  }, [shell.activeUrl]);

  return (
    <ControllerShell
      connectionStatus={shell.connectionStatus}
      roomId={shell.roomId}
      gameState="playing" // Shell is always playing
      onReconnect={handleReconnect}
      onTogglePlayPause={() => {}} // Disable play/pause for now
      onRefresh={() => window.location.reload()}
      requiredOrientation="landscape"
    >
      {/* --- CHILD GAME CONTROLLER --- */}
      {shell.activeUrl && (
        <div className="absolute inset-0 z-50 bg-background">
            {/* Exit Button Overlay */}
            <button 
                className="absolute top-2 right-2 z-[60] p-2 bg-black/50 text-white rounded-full hover:bg-red-600 transition-colors"
                onClick={() => {
                    if (confirm("Exit Game?")) {
                        shell.sendSystemCommand("EXIT_GAME");
                    }
                }}
            >
                <X size={24} />
            </button>
            
          <iframe
            ref={iframeRef}
            src={`${shell.activeUrl}${
              shell.activeUrl.includes("?") ? "&" : "?"
            }airjam_mode=child&airjam_force_connect=true&aj_controller_id=${
              shell.controllerId
            }&aj_room=${shell.roomId}`}
            className="w-full h-full border-none"
            allow="vibrate; gyroscope; accelerometer; autoplay; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
      )}

      {/* --- DEFAULT ARCADE CONTROLLER --- */}
      {!shell.activeUrl && (
        <>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 opacity-20 pointer-events-none">
                <h1 className="text-3xl font-black uppercase italic tracking-tighter select-none">
                Air Jam <span className="text-primary">Arcade</span>
                </h1>
            </div>

            <div className="flex w-full h-full items-center justify-between px-12 pb-8">
                <div className="flex items-end justify-start w-1/3">
                <DPad onMove={setVector} />
                </div>
                <div className="flex flex-col items-center justify-end w-1/3 pb-8 gap-4">
                </div>
                <div className="flex items-center justify-end w-1/3 gap-6 transform rotate-6 translate-y-4">
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
