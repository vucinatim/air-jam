"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAirJamController, ControllerShell } from "@air-jam/sdk";
import { cn } from "@/lib/utils";

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
  const controller = useAirJamController();
  const [vector, setVector] = useState({ x: 0, y: 0 });
  const [action, setAction] = useState(false);
  const [ability, setAbility] = useState(false);

  // Send input loop (approx 60fps)
  useEffect(() => {
    if (controller.connectionStatus !== "connected") return;

    let animationFrameId: number;

    const loop = () => {
      controller.sendInput({
        vector,
        action,
        ability,
        timestamp: Date.now(),
        togglePlayPause: false, // Handled by header button
      });
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [controller.connectionStatus, vector, action, ability, controller]); // Check dependencies carefully. controller object is stable-ish.

  // Handle Nickname
  const [hasSetNickname, setHasSetNickname] = useState(false);
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  if (
    controller.connectionStatus === "connected" &&
    !hasSetNickname &&
    !controller.lastError
  ) {
    // Optional: Prompt for nickname if not set via URL or storage
    // For now, let's just auto-confirm or show a simple overlay
  }

  const handleReconnect = (roomCode: string) => {
    router.push(`?room=${roomCode}`);
  };

  const handleTogglePlayPause = () => {
    // Send a one-off input with togglePlayPause
    controller.sendInput({
      vector: { x: 0, y: 0 },
      action: false,
      ability: false,
      timestamp: Date.now(),
      togglePlayPause: true,
    });
  };

  return (
    <ControllerShell
      connectionStatus={controller.connectionStatus}
      roomId={controller.roomId}
      gameState={controller.gameState}
      onReconnect={handleReconnect}
      onTogglePlayPause={handleTogglePlayPause}
      requiredOrientation="landscape" // Arcade feel
    >
      {/* Branding */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 opacity-20 pointer-events-none">
        <h1 className="text-3xl font-black uppercase italic tracking-tighter select-none">
          Air Jam <span className="text-primary">Arcade</span>
        </h1>
      </div>

      <div className="flex w-full h-full items-center justify-between px-12 pb-8">
        {/* Left Side: D-Pad */}
        <div className="flex items-end justify-start w-1/3">
          <DPad onMove={setVector} />
        </div>

        {/* Center: Status / Start (Optional) */}
        <div className="flex flex-col items-center justify-end w-1/3 pb-8 gap-4">
          {/* Start / Select buttons could go here */}
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center justify-end w-1/3 gap-6 transform rotate-6 translate-y-4">
          {/* B Button (Ability) */}
          <div className="translate-y-8">
            <ActionButton
              label="B"
              color="yellow"
              onPress={() => setAbility(true)}
              onRelease={() => setAbility(false)}
            />
          </div>

          {/* A Button (Action) */}
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
    </ControllerShell>
  );
}
