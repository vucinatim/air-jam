"use client";

import { cn } from "@/lib/utils";
import {
  getRuntimeUrlOrigin,
  useVolumeStore,
} from "@air-jam/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildArcadeGameIframeSrc,
  createArcadeBridgeInitMessage,
  createArcadeSettingsSyncMessage,
} from "./arcade-bridge";

export interface GamePlayerGame {
  id: string;
  name: string;
  url: string;
  ownerName?: string | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
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
  const bridgePortRef = useRef<MessagePort | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Subscribe to volume settings from the arcade overlay
  const { masterVolume, musicVolume, sfxVolume } = useVolumeStore();

  const iframeSrc = buildArcadeGameIframeSrc({
    normalizedUrl,
    roomId,
    joinToken,
  });
  const iframeTargetOrigin = getRuntimeUrlOrigin(normalizedUrl);

  const establishBridgeChannel = useCallback(() => {
    const contentWindow = iframeRef.current?.contentWindow;
    if (!contentWindow) {
      return;
    }
    if (!iframeTargetOrigin) {
      console.warn("[GamePlayer] Bridge init blocked: invalid iframe origin", {
        gameId: game.id,
        url: normalizedUrl,
      });
      return;
    }

    const channel = new MessageChannel();

    // Reset previous bridge channel if present.
    try {
      bridgePortRef.current?.close();
    } catch {
      // Ignore close errors
    }

    bridgePortRef.current = channel.port1;
    bridgePortRef.current.start();

    contentWindow.postMessage(
      createArcadeBridgeInitMessage(),
      iframeTargetOrigin,
      [channel.port2],
    );
  }, [game.id, iframeTargetOrigin, normalizedUrl]);

  /**
   * Send current volume settings to the game iframe via postMessage.
   * The SDK's volume store in the game will listen for these messages.
   */
  const sendSettingsToGame = useCallback(() => {
    const payload = createArcadeSettingsSyncMessage({
      masterVolume,
      musicVolume,
      sfxVolume,
    });

    const bridgePort = bridgePortRef.current;
    if (bridgePort) {
      bridgePort.postMessage(payload);
      return;
    }

    if (!iframeTargetOrigin) {
      return;
    }

    iframeRef.current?.contentWindow?.postMessage(payload, iframeTargetOrigin);
  }, [masterVolume, musicVolume, sfxVolume, iframeTargetOrigin]);

  // Send settings whenever they change (and iframe is loaded)
  useEffect(() => {
    if (iframeLoaded && isVisible) {
      sendSettingsToGame();
    }
  }, [iframeLoaded, isVisible, sendSettingsToGame]);

  useEffect(() => {
    return () => {
      try {
        bridgePortRef.current?.close();
      } catch {
        // Ignore close errors
      }
      bridgePortRef.current = null;
    };
  }, []);

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 bg-black transition-transform duration-500",
        isVisible ? "translate-y-0" : "translate-y-full",
      )}
    >
      {!iframeSrc && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black p-6 text-center text-white">
          <div>
            <p className="text-lg font-semibold">Invalid Game URL</p>
            <p className="mt-2 text-sm text-zinc-300">
              This game cannot be loaded because its URL is not a valid http(s)
              origin.
            </p>
          </div>
        </div>
      )}
      {iframeSrc && (
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
            establishBridgeChannel();
            setIframeLoaded(true);
            // Send initial settings after a small delay to ensure the game is ready
            setTimeout(sendSettingsToGame, 100);
          }}
          onError={(e) => {
            console.error("[GamePlayer] Iframe error", e);
          }}
        />
      )}

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
