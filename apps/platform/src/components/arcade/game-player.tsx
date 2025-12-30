"use client";

import { cn } from "@/lib/utils";
import { useVolumeStore } from "@air-jam/sdk";
import { useCallback, useEffect, useRef, useState } from "react";

export interface GamePlayerGame {
  id: string;
  name: string;
  url: string;
}

interface GamePlayerProps {
  game: GamePlayerGame;
  normalizedUrl: string;
  joinToken: string;
  roomId: string;
  isVisible: boolean;
  onExit: () => void;
  /** Whether to show the default exit button overlay */
  showExitOverlay?: boolean;
}

/**
 * Renders a game in an iframe with the proper Air Jam arcade protocol params.
 * Used by both the Arcade and Preview systems.
 */
export const GamePlayer = ({
  game,
  normalizedUrl,
  joinToken,
  roomId,
  isVisible,
  onExit,
  showExitOverlay = true,
}: GamePlayerProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Subscribe to volume settings from the arcade overlay
  const { masterVolume, musicVolume, sfxVolume } = useVolumeStore();

  const iframeSrc = `${normalizedUrl}${
    game.url.includes("?") ? "&" : "?"
  }aj_room=${roomId}&aj_token=${joinToken}`;

  /**
   * Send current volume settings to the game iframe via postMessage.
   * The SDK's volume store in the game will listen for these messages.
   */
  const sendSettingsToGame = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;

    iframeRef.current.contentWindow.postMessage(
      {
        type: "AIRJAM_SETTINGS_SYNC",
        payload: { masterVolume, musicVolume, sfxVolume },
      },
      "*",
    );
  }, [masterVolume, musicVolume, sfxVolume]);

  // Send settings whenever they change (and iframe is loaded)
  useEffect(() => {
    if (iframeLoaded && isVisible) {
      sendSettingsToGame();
    }
  }, [iframeLoaded, isVisible, sendSettingsToGame]);

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 bg-black transition-transform duration-500",
        isVisible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        className="h-full w-full border-none bg-black"
        style={{ backgroundColor: "#000000" }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; gamepad"
        onLoad={() => {
          console.log("[GamePlayer] Iframe loaded", {
            gameId: game.id,
            src: iframeRef.current?.src,
          });
          setIframeLoaded(true);
          // Send initial settings after a small delay to ensure the game is ready
          setTimeout(sendSettingsToGame, 100);
        }}
        onError={(e) => {
          console.error("[GamePlayer] Iframe error", e);
        }}
      />

      {/* Default exit overlay (shown on hover) */}
      {showExitOverlay && (
        <div className="absolute top-4 right-4 z-50 opacity-0 transition-opacity hover:opacity-100">
          <button
            onClick={onExit}
            className="rounded bg-red-600/80 px-4 py-2 text-white shadow-lg backdrop-blur hover:bg-red-600"
          >
            Exit Game
          </button>
        </div>
      )}
    </div>
  );
};
