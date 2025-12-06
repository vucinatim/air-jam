import { Html5Qrcode } from "html5-qrcode";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { roomCodeSchema } from "../protocol";
import { urlBuilder } from "../utils/url-builder";
import { Button } from "./ui/button";

interface QRScannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (roomCode: string) => void;
  currentRoomId?: string | null;
}

/**
 * Extracts room code from a scanned URL or text.
 * Supports formats like:
 * - http://host/joypad?room=CODE
 * - https://host/joypad?room=CODE
 * - Just the room code itself
 */
const extractRoomCode = (text: string): string | null => {
  try {
    // Try to parse as URL
    const url = new URL(text);
    const roomParam = url.searchParams.get("room");
    if (roomParam) {
      const parsed = roomCodeSchema.safeParse(roomParam.toUpperCase());
      if (parsed.success) {
        return parsed.data;
      }
    }
  } catch {
    // Not a URL, try as direct room code
  }

  // Try as direct room code
  const parsed = roomCodeSchema.safeParse(text.trim().toUpperCase());
  if (parsed.success) {
    return parsed.data;
  }

  return null;
};

export const QRScannerDialog = ({
  isOpen,
  onClose,
  onScan,
  currentRoomId,
}: QRScannerDialogProps): JSX.Element | null => {
  const [code, setCode] = useState("");
  const [isCameraAvailable, setIsCameraAvailable] = useState(false);
  const [joinUrl, setJoinUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevIsOpenRef = useRef(false);

  // Reset state when dialog opens and build URL
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Prefill with current room code if available
      const initialCode = currentRoomId || "";
      setTimeout(() => {
        setIsCameraAvailable(false);
        setCode(initialCode);
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, currentRoomId]);

  // Build join URL when code changes
  useEffect(() => {
    const buildUrl = async (): Promise<void> => {
      const trimmed = code.trim().toUpperCase();
      const parsed = roomCodeSchema.safeParse(trimmed);
      if (parsed.success) {
        try {
          const url = await urlBuilder.buildControllerUrl(parsed.data);
          setJoinUrl(url);
        } catch {
          setJoinUrl("");
        }
      } else {
        setJoinUrl("");
      }
    };
    buildUrl();
  }, [code]);

  // Clean up scanner when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setIsCameraAvailable(false);
      }, 0);
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        scanner
          .stop()
          .catch(() => {
            // Ignore errors
          })
          .finally(() => {
            try {
              scanner.clear();
            } catch {
              // Ignore errors
            }
          });
        scannerRef.current = null;
      }
    }
  }, [isOpen]);

  // Try to start camera (silently fail if not available)
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const containerId = "qr-reader";
    let scanner: Html5Qrcode | null = null;
    let scannerRunning = false;
    let mounted = true;

    const startScanning = async (): Promise<void> => {
      try {
        const container = document.getElementById(containerId);
        if (!container) {
          return;
        }

        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          return;
        }

        scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        // Try to get available cameras
        let cameraId: string | null = null;
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            const backCamera = devices.find(
              (d) =>
                d.label.toLowerCase().includes("back") ||
                d.label.toLowerCase().includes("rear"),
            );
            const envCamera = devices.find((d) => {
              const label = d.label.toLowerCase();
              return (
                label.includes("environment") || label.includes("facing back")
              );
            });
            cameraId = (envCamera || backCamera || devices[0])?.id || null;
          }
        } catch {
          // Ignore camera enumeration errors
        }

        const config = cameraId
          ? { deviceId: { exact: cameraId } }
          : { facingMode: "environment" };

        await scanner.start(
          config,
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const qrboxSize = Math.min(250, minEdge * 0.8);
              return {
                width: qrboxSize,
                height: qrboxSize,
              };
            },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (!mounted) return;
            const roomCode = extractRoomCode(decodedText);
            if (roomCode) {
              setCode(roomCode);
              // Stop scanner after successful scan
              scannerRunning = false;
              scanner
                ?.stop()
                .catch(() => {})
                .finally(() => {
                  if (mounted) {
                    setIsCameraAvailable(false);
                  }
                });
            }
          },
          () => {
            // Ignore scanning errors
          },
        );
        scannerRunning = true;
        if (mounted) {
          setIsCameraAvailable(true);
        }
      } catch {
        // Silently fail - camera not available or permission denied
        if (mounted) {
          setIsCameraAvailable(false);
        }
        if (scanner) {
          try {
            scanner.clear();
          } catch {
            // Ignore
          }
        }
        scannerRef.current = null;
      }
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      startScanning();
    }, 200);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (scanner && scannerRunning) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scanner?.clear();
            } catch {
              // Ignore
            }
          });
      } else if (scanner) {
        try {
          scanner.clear();
        } catch {
          // Ignore
        }
      }
      scannerRef.current = null;
    };
  }, [isOpen]);

  const handleSubmit = (): void => {
    const trimmed = code.trim().toUpperCase();
    const parsed = roomCodeSchema.safeParse(trimmed);

    if (parsed.success) {
      onScan(parsed.data);
      onClose();
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>): void => {
    e.target.select();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setCode(e.target.value.toUpperCase());
    setCopied(false);
  };

  const handleCopyUrl = async (): Promise<void> => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = joinUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Ignore
      }
      document.body.removeChild(textArea);
    }
  };

  if (!isOpen) {
    return null;
  }

  const isValid = code.trim().length > 0;

  return (
    <div className="bg-background fixed inset-0 z-50 flex flex-col items-center justify-center">
      {/* Camera view (if available) */}
      <div className="flex flex-1 flex-col items-center justify-center">
        {isCameraAvailable && (
          <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden p-6">
            <div
              id="qr-reader"
              className="h-full w-full overflow-hidden rounded-lg bg-black"
            />
          </div>
        )}

        {/* Input field */}
        <div className="w-full max-w-md px-6">
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isValid) {
                handleSubmit();
              }
            }}
            placeholder="Enter room code"
            className="border-border bg-background focus:ring-primary focus:border-primary w-full rounded-lg border-2 px-6 py-4 text-center font-mono text-2xl focus:ring-2 focus:outline-none"
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>
        {/* URL Display */}
        {joinUrl && (
          <div className="mt-4 w-full max-w-md px-6 pb-2">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted w-full rounded-lg px-4 py-3 text-center font-mono text-xs break-all transition-colors"
            >
              {copied ? "✓ Copied!" : joinUrl}
            </button>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex w-full max-w-md gap-4 px-6 pb-6">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="flex-1 py-6"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid}
          className="flex-1 py-6"
        >
          Connect
        </Button>
      </div>
    </div>
  );
};
