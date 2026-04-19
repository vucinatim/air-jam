import {
  REVEAL_PAUSE_LEAD_MS,
  REVEAL_START_VOLUME,
  SKIPPABLE_YOUTUBE_ERROR_CODES,
  VIDEO_MIX_TICK_MS,
  YOUTUBE_MAX_VOLUME,
} from "@/config";
import { type ActiveRound, type RoundReveal } from "@/store/types";
import { type GamePhase } from "@/types";
import { clampNumber } from "@/utils/math-utils";
import { useMusicVolume } from "@air-jam/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseYouTubeMessageData,
  sendYouTubeCommand,
  setYouTubeVolume,
} from "./youtube-commands";

interface UseYouTubePlayerInput {
  phase: GamePhase;
  embedUrl: string | null;
  muted: boolean;
  currentRound: ActiveRound | null;
  roundReveal: RoundReveal | null;
  revealDurationSec: number;
  finalizeRound: (payload: { nowMs?: number }) => void;
}

interface UseYouTubePlayerResult {
  youtubePlayerRef: React.RefObject<HTMLIFrameElement | null>;
  loadedEmbedUrl: string | null;
  onIframeLoad: () => void;
}

export const useYouTubePlayer = ({
  phase,
  embedUrl,
  muted,
  currentRound,
  roundReveal,
  revealDurationSec,
  finalizeRound,
}: UseYouTubePlayerInput): UseYouTubePlayerResult => {
  const youtubePlayerRef = useRef<HTMLIFrameElement | null>(null);
  const lastYouTubeVolumeRef = useRef<number | null>(null);
  const skippedRoundNumberRef = useRef<number | null>(null);
  const [loadedEmbedUrl, setLoadedEmbedUrl] = useState<string | null>(null);
  const musicVolume = useMusicVolume();
  const getYouTubeMusicVolume = useCallback(
    (volume: number) =>
      Math.round(clampNumber(volume * musicVolume, 0, YOUTUBE_MAX_VOLUME)),
    [musicVolume],
  );

  // Reset skipped round tracker when leaving round-active
  useEffect(() => {
    if (phase !== "round-active") {
      skippedRoundNumberRef.current = null;
    }
  }, [phase]);

  // Active mix: full volume during round-active
  useEffect(() => {
    if (phase !== "round-active" || !embedUrl || loadedEmbedUrl !== embedUrl) {
      return;
    }

    const applyActiveMix = () => {
      sendYouTubeCommand(youtubePlayerRef.current, "playVideo");
      if (muted) {
        sendYouTubeCommand(youtubePlayerRef.current, "mute");
        setYouTubeVolume(youtubePlayerRef.current, 0);
        lastYouTubeVolumeRef.current = 0;
        return;
      }
      sendYouTubeCommand(youtubePlayerRef.current, "unMute");
      const nextVolume = getYouTubeMusicVolume(YOUTUBE_MAX_VOLUME);
      setYouTubeVolume(youtubePlayerRef.current, nextVolume);
      lastYouTubeVolumeRef.current = nextVolume;
    };

    const timerId = window.setTimeout(applyActiveMix, 80);
    return () => window.clearTimeout(timerId);
  }, [phase, embedUrl, getYouTubeMusicVolume, loadedEmbedUrl, muted]);

  // Reveal mix: fade volume down during round-reveal
  useEffect(() => {
    if (phase !== "round-reveal" || !roundReveal) {
      return;
    }

    const revealStartMs = roundReveal.revealEndsAtMs - revealDurationSec * 1000;
    const revealDurationMs = Math.max(
      1,
      roundReveal.revealEndsAtMs - revealStartMs,
    );

    const applyRevealMix = () => {
      sendYouTubeCommand(youtubePlayerRef.current, "playVideo");
      if (muted) {
        sendYouTubeCommand(youtubePlayerRef.current, "mute");
        setYouTubeVolume(youtubePlayerRef.current, 0);
        lastYouTubeVolumeRef.current = 0;
        return;
      }
      sendYouTubeCommand(youtubePlayerRef.current, "unMute");

      const now = Date.now();
      const fadeProgress = clampNumber(
        (now - revealStartMs) / revealDurationMs,
        0,
        1,
      );
      const targetVolume = REVEAL_START_VOLUME * (1 - fadeProgress);
      const nextVolume = getYouTubeMusicVolume(targetVolume);

      if (lastYouTubeVolumeRef.current !== nextVolume) {
        setYouTubeVolume(youtubePlayerRef.current, nextVolume);
        lastYouTubeVolumeRef.current = nextVolume;
      }
    };

    const startDelayId = window.setTimeout(applyRevealMix, 120);
    const intervalId = window.setInterval(applyRevealMix, VIDEO_MIX_TICK_MS);
    const pauseDelayMs = Math.max(
      0,
      roundReveal.revealEndsAtMs - Date.now() - REVEAL_PAUSE_LEAD_MS,
    );
    const pauseId = window.setTimeout(() => {
      setYouTubeVolume(youtubePlayerRef.current, 0);
      sendYouTubeCommand(youtubePlayerRef.current, "pauseVideo");
      lastYouTubeVolumeRef.current = 0;
    }, pauseDelayMs);

    return () => {
      window.clearTimeout(startDelayId);
      window.clearInterval(intervalId);
      window.clearTimeout(pauseId);
    };
  }, [phase, roundReveal, revealDurationSec, muted, getYouTubeMusicVolume]);

  // Mute during lobby/game-over or when host toggle is muted
  useEffect(() => {
    if (muted || phase === "lobby" || phase === "game-over") {
      sendYouTubeCommand(youtubePlayerRef.current, "mute");
      setYouTubeVolume(youtubePlayerRef.current, 0);
      lastYouTubeVolumeRef.current = 0;
    }
  }, [muted, phase]);

  // Handle YouTube errors — skip broken videos
  useEffect(() => {
    const handleYouTubeMessage = (event: MessageEvent<unknown>) => {
      const currentFrame = youtubePlayerRef.current;
      if (!currentFrame || event.source !== currentFrame.contentWindow) {
        return;
      }

      const messageData = parseYouTubeMessageData(event.data);
      if (!messageData || messageData.event !== "onError") {
        return;
      }

      const errorCode = Number(messageData.info);
      if (!SKIPPABLE_YOUTUBE_ERROR_CODES.has(errorCode)) {
        return;
      }

      if (phase !== "round-active" || !currentRound) {
        return;
      }

      if (skippedRoundNumberRef.current === currentRound.roundNumber) {
        return;
      }

      skippedRoundNumberRef.current = currentRound.roundNumber;
      setYouTubeVolume(currentFrame, 0);
      sendYouTubeCommand(currentFrame, "pauseVideo");
      lastYouTubeVolumeRef.current = 0;
      finalizeRound({ nowMs: currentRound.endsAtMs });
    };

    window.addEventListener("message", handleYouTubeMessage);
    return () => window.removeEventListener("message", handleYouTubeMessage);
  }, [finalizeRound, currentRound, phase]);

  const onIframeLoad = () => {
    setLoadedEmbedUrl(embedUrl);
    const currentFrame = youtubePlayerRef.current;
    sendYouTubeCommand(currentFrame, "addEventListener", ["onError"]);
    sendYouTubeCommand(currentFrame, "addEventListener", ["onReady"]);
  };

  return { youtubePlayerRef, loadedEmbedUrl, onIframeLoad };
};
