import { useCallback, useMemo, useRef, useState } from "react";

const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (!text) {
    return false;
  }

  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the DOM fallback.
  }

  if (typeof document === "undefined") {
    return false;
  }

  const fallbackField = document.createElement("textarea");
  fallbackField.value = text;
  fallbackField.style.position = "fixed";
  fallbackField.style.opacity = "0";
  document.body.appendChild(fallbackField);
  fallbackField.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(fallbackField);
  }
};

export interface UseHostLobbyShellOptions {
  joinUrl: string | null | undefined;
  canStartMatch?: boolean;
  onStartMatch?: () => void;
  copiedDurationMs?: number;
}

export interface HostLobbyShellApi {
  joinUrlValue: string;
  hasJoinUrl: boolean;
  copied: boolean;
  canStartMatch: boolean;
  handleCopy: () => Promise<void>;
  handleOpen: () => void;
  handleStart: () => void;
}

export const useHostLobbyShell = ({
  joinUrl,
  canStartMatch = false,
  onStartMatch,
  copiedDurationMs = 1800,
}: UseHostLobbyShellOptions): HostLobbyShellApi => {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  const joinUrlValue = useMemo(() => joinUrl ?? "", [joinUrl]);

  const handleCopy = useCallback(async () => {
    if (!joinUrlValue) {
      return;
    }

    const copiedSuccessfully = await copyTextToClipboard(joinUrlValue);
    if (!copiedSuccessfully || typeof window === "undefined") {
      return;
    }

    setCopied(true);

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, copiedDurationMs);
  }, [copiedDurationMs, joinUrlValue]);

  const handleOpen = useCallback(() => {
    if (!joinUrlValue || typeof window === "undefined") {
      return;
    }

    window.open(joinUrlValue, "_blank", "noopener,noreferrer");
  }, [joinUrlValue]);

  const handleStart = useCallback(() => {
    if (!canStartMatch) {
      return;
    }

    onStartMatch?.();
  }, [canStartMatch, onStartMatch]);

  return {
    joinUrlValue,
    hasJoinUrl: joinUrlValue.length > 0,
    copied,
    canStartMatch,
    handleCopy,
    handleOpen,
    handleStart,
  };
};
