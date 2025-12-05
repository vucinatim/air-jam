/* eslint-disable react-hooks/set-state-in-effect */
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
  const [hasSetNickname] = useState(false);

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

  // --- CHILD CONTROLLER IFRAME LOGIC ---
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [childControllerReady, setChildControllerReady] = useState(false);

  // Helper to normalize URLs - replace localhost with current hostname for mobile devices
  const normalizeUrlForMobile = (url: string): string => {
    if (typeof window === "undefined") return url;

    try {
      const urlObj = new URL(url);
      /*
      console.log(
        "[Platform Joypad] Normalizing URL:",
        url,
        "hostname:",
        urlObj.hostname,
        "current hostname:",
        window.location.hostname
      );
      */

      // If URL uses localhost, replace with current hostname
      if (urlObj.hostname === "localhost" || urlObj.hostname === "127.0.0.1") {
        urlObj.hostname = window.location.hostname;
        const normalized = urlObj.toString();
        // console.log("[Platform Joypad] Normalizing URL:", normalized);
        return normalized;
      }
      return url;
    } catch (error) {
      console.error("[Platform Joypad] Failed to normalize URL:", url, error);
      return url;
    }
  };

  // Check if we should be showing a game controller
  const rawControllerUrl =
    controller.gameState === "playing" &&
    controller.stateMessage &&
    controller.stateMessage.startsWith("http")
      ? controller.stateMessage
      : null;

  // Normalize the URL - the Arcade already sends the full URL with /joypad appended
  // So we just need to normalize it (replace localhost) and clean up any double slashes
  const [gameControllerUrl, setGameControllerUrl] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (rawControllerUrl) {
      // Add a small delay to ensure the Game Host has initialized and taken over the room
      // before we load the controller and try to join. This prevents race conditions.
      const timer = setTimeout(() => {
        setGameControllerUrl(
          normalizeUrlForMobile(
            rawControllerUrl.replace(/([^:]\/)\/+/g, "$1").replace(/\/$/, "")
          )
        );
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setGameControllerUrl(null);
    }
  }, [rawControllerUrl]);

  // Log when game controller URL changes
  useEffect(() => {
    if (gameControllerUrl) {
      // console.log("[Platform Joypad] Loading game controller:", gameControllerUrl);
      setIframeError(null);
      setIframeLoaded(false);
    } else {
      // console.log("[Platform Joypad] No game controller URL");
      setIframeError(null);
      setIframeLoaded(false);
    }
  }, [gameControllerUrl, controller.stateMessage, controller.gameState]);

  // Handle iframe load
  const handleIframeLoad = () => {
    // console.log("[Platform Joypad] Iframe loaded successfully");
    setIframeLoaded(true);
    setIframeError(null);
  };

  // Timeout check for iframe loading - check both iframe load AND child ready message
  useEffect(() => {
    if (!gameControllerUrl) return;

    // console.log("[Platform Joypad] Setting up timeout check for:", gameControllerUrl);

    const timeout = setTimeout(() => {
      // Iframe element loaded but child didn't send AIRJAM_READY, it might still be loading or have an error
      if (iframeLoaded && !childControllerReady && !iframeError) {
        const errorMsg = `Iframe loaded but game controller didn't initialize. Check if game server allows iframe embedding (CSP: frame-ancestors *). URL: ${gameControllerUrl}`;
        console.warn("[Platform Joypad]", errorMsg);
        setIframeError(errorMsg);
      } else if (!iframeLoaded && !iframeError) {
        const errorMsg = `Timeout: Game controller failed to load after 10 seconds. URL: ${gameControllerUrl}`;
        console.error("[Platform Joypad]", errorMsg, {
          iframeRef: iframeRef.current ? "exists" : "null",
          iframeSrc: iframeRef.current?.src,
        });
        setIframeError(errorMsg);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [gameControllerUrl, iframeLoaded, childControllerReady, iframeError]);

  // Listen for AIRJAM_READY from child iframe
  useEffect(() => {
    if (!gameControllerUrl) {
      setChildControllerReady(false);
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === "AIRJAM_READY") {
        // console.log("[Platform Joypad] Child controller sent AIRJAM_READY");
        setChildControllerReady(true);
        setIframeError(null);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [gameControllerUrl]);

  return (
    <ControllerShell
      connectionStatus={controller.connectionStatus}
      roomId={controller.roomId}
      gameState={controller.gameState}
      onReconnect={handleReconnect}
      onTogglePlayPause={handleTogglePlayPause}
      onRefresh={controller.reconnect}
      requiredOrientation="landscape" // Arcade feel
    >
      {/* --- CHILD GAME CONTROLLER --- */}
      {gameControllerUrl && (
        <div className="absolute inset-0 z-50 bg-background">
          {iframeError && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 p-4 z-50">
              <div className="text-center text-red-400 max-w-md">
                <p className="font-bold text-lg">Controller Load Error</p>
                <p className="text-sm mt-2">{iframeError}</p>
                <p className="text-xs mt-4 text-muted-foreground">
                  Possible causes:
                </p>
                <ul className="text-xs mt-2 text-left text-muted-foreground list-disc list-inside">
                  <li>Game server not running</li>
                  <li>
                    Game server blocking iframe embedding (check CSP headers)
                  </li>
                  <li>Network/CORS issue</li>
                  <li>Invalid URL</li>
                </ul>
                <p className="text-xs mt-4 text-muted-foreground">
                  Check browser console for details
                </p>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={`${gameControllerUrl}${
              gameControllerUrl.includes("?") ? "&" : "?"
            }airjam_mode=child&airjam_force_connect=true&controllerId=${
              controller.controllerId
            }&room=${controller.roomId}`}
            className="w-full h-full border-none"
            allow="vibrate; gyroscope; accelerometer; autoplay; fullscreen"
            // Note: sandbox attribute can be restrictive. We allow what's needed for games to work.
            // For production, games should set proper headers instead of relying on sandbox.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
            onLoad={handleIframeLoad}
            onError={(e) => {
              console.error("[Platform Joypad] Iframe error event:", e);
              setIframeError(
                "Iframe failed to load - check console for details"
              );
            }}
            style={{ display: iframeError ? "none" : "block" }}
          />
          {/* Debug info */}
          {process.env.NODE_ENV === "development" && gameControllerUrl && (
            <div className="absolute top-0 left-0 bg-black/80 text-white text-xs p-2 z-50 pointer-events-none max-w-xs">
              <div>URL: {gameControllerUrl}</div>
              <div>Iframe Loaded: {iframeLoaded ? "Yes" : "No"}</div>
              <div>Child Ready: {childControllerReady ? "Yes" : "No"}</div>
              <div>Error: {iframeError || "None"}</div>
            </div>
          )}
          {!iframeLoaded && !iframeError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <div className="text-center text-muted-foreground">
                <p>Loading game controller...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- DEFAULT ARCADE CONTROLLER --- */}
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
