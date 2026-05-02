import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

export interface UseHostJoinControlsOptions {
  joinUrl: string | null | undefined;
  canStartMatch?: boolean;
  onStartMatch?: () => void;
  copiedDurationMs?: number;
}

export interface HostJoinControlsApi {
  joinUrlValue: string;
  hasJoinUrl: boolean;
  copied: boolean;
  joinQrVisible: boolean;
  canStartMatch: boolean;
  handleCopy: () => Promise<void>;
  handleOpen: () => void;
  showJoinQr: () => void;
  hideJoinQr: () => void;
  toggleJoinQr: () => void;
  handleStart: () => void;
}

export const useHostJoinControls = ({
  joinUrl,
  canStartMatch = false,
  onStartMatch,
  copiedDurationMs = 1800,
}: UseHostJoinControlsOptions): HostJoinControlsApi => {
  const [copied, setCopied] = useState(false);
  const [joinQrVisible, setJoinQrVisible] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  const joinUrlValue = useMemo(() => joinUrl ?? "", [joinUrl]);
  const hasJoinUrl = joinUrlValue.length > 0;

  useEffect(() => {
    if (!hasJoinUrl) {
      setJoinQrVisible(false);
    }
  }, [hasJoinUrl]);

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

  const showJoinQr = useCallback(() => {
    if (!hasJoinUrl) {
      return;
    }

    setJoinQrVisible(true);
  }, [hasJoinUrl]);

  const hideJoinQr = useCallback(() => {
    setJoinQrVisible(false);
  }, []);

  const toggleJoinQr = useCallback(() => {
    if (!hasJoinUrl) {
      return;
    }

    setJoinQrVisible((current) => !current);
  }, [hasJoinUrl]);

  const handleStart = useCallback(() => {
    if (!canStartMatch) {
      return;
    }

    onStartMatch?.();
  }, [canStartMatch, onStartMatch]);

  return {
    joinUrlValue,
    hasJoinUrl,
    copied,
    joinQrVisible,
    canStartMatch,
    handleCopy,
    handleOpen,
    showJoinQr,
    hideJoinQr,
    toggleJoinQr,
    handleStart,
  };
};
