"use client";

import { ControllerMenuNotch } from "@/components/controller-menu-notch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getControllerLocalProfileClientSnapshot,
  getControllerLocalProfileServerSnapshot,
  subscribeControllerLocalProfile,
  toProfilePatch,
  writeControllerLocalProfile,
  type ControllerPersistedProfile,
} from "@/lib/controller-local-profile";
import { CONTROLLER_AVATAR_PRESETS } from "@/lib/controller-profile-presets";
import { parseRoomFromQrText } from "@/lib/parse-room-from-qr-text";
import { cn } from "@/lib/utils";
import {
  useAirJamController,
  type ControllerOrientation,
  type DocumentWithFullscreen,
  type ElementWithFullscreen,
} from "@air-jam/sdk";
import { LogOut, Maximize, QrCode, ScanLine, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

interface ControllerMenuSheetProps {
  routeRoomId: string | null;
  activeUrl: string | null;
  emitArcadeAction: (action: string) => void;
  controllerOrientation: ControllerOrientation;
  documentFullscreen: boolean;
}

export function ControllerMenuSheet({
  routeRoomId,
  activeUrl,
  emitArcadeAction,
  controllerOrientation,
  documentFullscreen,
}: ControllerMenuSheetProps) {
  const router = useRouter();
  const controller = useAirJamController();

  const localProfile = useSyncExternalStore(
    subscribeControllerLocalProfile,
    getControllerLocalProfileClientSnapshot,
    getControllerLocalProfileServerSnapshot,
  );

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ControllerPersistedProfile>({
    label: "",
    avatarId: "",
  });
  const [roomDraft, setRoomDraft] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const displayedRoomId = controller.roomId ?? routeRoomId;

  const connectionLabels: Record<
    NonNullable<typeof controller.connectionStatus>,
    string
  > = {
    connected: "Connected",
    connecting: "Connecting",
    disconnected: "Disconnected",
    idle: "Idle",
    reconnecting: "Reconnecting",
  };

  const statusDotClass =
    controller.connectionStatus === "connected"
      ? "bg-emerald-400"
      : controller.connectionStatus === "connecting" ||
          controller.connectionStatus === "reconnecting"
        ? "animate-pulse bg-amber-300"
        : controller.connectionStatus === "idle"
          ? "bg-slate-500"
          : "bg-rose-400";

  const connectionNotchPulse =
    controller.connectionStatus === "connecting" ||
    controller.connectionStatus === "reconnecting";

  const connectionLabel =
    connectionLabels[controller.connectionStatus] ??
    controller.connectionStatus;

  const toggleOverlay = useCallback(() => {
    if (!overlayOpen) {
      const self = controller.players.find(
        (p) => p.id === controller.controllerId,
      );
      setProfileDraft({
        label: self?.label ?? localProfile.label,
        avatarId: self?.avatarId ?? localProfile.avatarId,
      });
      setRoomDraft(displayedRoomId ?? "");
    }
    setOverlayOpen((prev) => !prev);
  }, [
    controller.controllerId,
    controller.players,
    displayedRoomId,
    localProfile,
    overlayOpen,
  ]);

  const applyRoom = useCallback(() => {
    const code = roomDraft
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (code.length < 4) {
      return;
    }

    // If we're already in a room, disconnect first
    if (controller.roomId && controller.roomId !== code) {
      controller.socket?.disconnect();
    }

    router.replace(`/controller?room=${encodeURIComponent(code)}`);
    setOverlayOpen(false);
  }, [roomDraft, router, controller.roomId, controller.socket]);

  const saveProfile = useCallback(async () => {
    const next: ControllerPersistedProfile = {
      label: profileDraft.label.trim().slice(0, 24),
      avatarId: profileDraft.avatarId,
    };
    if (!next.label) {
      return;
    }
    writeControllerLocalProfile(next);
    controller.setNickname(next.label);
    controller.setAvatarId(next.avatarId);
    await controller.updatePlayerProfile(toProfilePatch(next));
    setOverlayOpen(false);
  }, [controller, profileDraft]);

  useEffect(() => {
    if (!scanning) {
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let videoEl: HTMLVideoElement | null = null;

    const run = async () => {
      const BarcodeDetectorApi = (
        globalThis as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => {
            detect: (
              source: HTMLVideoElement,
            ) => Promise<{ rawValue?: string }[]>;
          };
        }
      ).BarcodeDetector;

      if (!BarcodeDetectorApi) {
        alert("QR scanning is not supported in this browser.");
        setScanning(false);
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        alert("Camera permission is required to scan a QR code.");
        setScanning(false);
        return;
      }

      if (cancelled || !videoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      videoEl = videoRef.current;
      videoEl.srcObject = stream;
      await videoEl.play();

      const detector = new BarcodeDetectorApi({ formats: ["qr_code"] });

      const tick = async () => {
        if (cancelled || !videoEl) {
          return;
        }
        try {
          const codes = await detector.detect(videoEl);
          const raw = codes[0]?.rawValue;
          if (raw) {
            const room = parseRoomFromQrText(raw);
            if (room) {
              setRoomDraft(room);
              setScanning(false);
              stream?.getTracks().forEach((t) => t.stop());
              return;
            }
          }
        } catch {
          // ignore frame errors
        }
        globalThis.requestAnimationFrame(() => {
          void tick();
        });
      };

      void tick();
    };

    void run();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [scanning]);

  const topChromePadding = documentFullscreen
    ? "pt-2"
    : "pt-[max(0.5rem,env(safe-area-inset-top))]";
  const notchPlacement =
    activeUrl && controllerOrientation === "landscape" ? "right" : "top";
  const landscapeMenu = notchPlacement === "right";
  const notchOffsetClass = documentFullscreen
    ? landscapeMenu
      ? "mr-0"
      : "mt-0"
    : landscapeMenu
      ? "mr-[env(safe-area-inset-right)]"
      : "mt-[env(safe-area-inset-top)]";
  const overlayFrameClass = landscapeMenu
    ? "items-stretch justify-end bg-black/72 backdrop-blur-sm"
    : "flex-col bg-black/97";
  const overlayPanelClass = landscapeMenu
    ? "border-border/50 flex h-full w-full max-w-md flex-col border-l bg-black/97 shadow-2xl"
    : "flex h-full w-full flex-col bg-black/97";
  const overlayBodyClass = landscapeMenu
    ? "min-h-0 flex-1 overflow-y-auto px-4 py-5"
    : "min-h-0 flex-1 overflow-y-auto px-4 py-6";

  const overlayChrome = (
    <header
      className={cn(
        "border-border/40 relative flex w-full shrink-0 items-center border-b px-3 pb-2",
        topChromePadding,
      )}
    >
      <span className="sr-only" aria-live="polite">
        {`Connection ${connectionLabel}`}
      </span>
      <div className="flex min-w-0 flex-1 items-center pr-2 pl-1">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-muted-foreground text-[9px] font-medium tracking-[0.2em] uppercase">
              Room
            </p>
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                statusDotClass,
              )}
              aria-hidden
            />
          </div>
          <p
            className="truncate text-base leading-tight font-semibold tracking-wide tabular-nums"
            title={displayedRoomId ?? undefined}
          >
            {displayedRoomId ?? "—"}
          </p>
        </div>
      </div>

      {/* Empty space for the fixed notch to sit over */}
      {!landscapeMenu ? <div className="w-[96px] shrink-0" /> : null}

      <div className="flex min-w-0 flex-1 justify-end gap-2 pl-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            emitArcadeAction("airjam.arcade.toggle_qr");
            setOverlayOpen(false);
          }}
          aria-label="Toggle host join QR"
          title="Toggle host join QR"
        >
          <QrCode className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            const doc = document as DocumentWithFullscreen;
            const root = document.documentElement;
            if (!root) return;
            const el = root as ElementWithFullscreen;

            if (
              doc.fullscreenElement ||
              doc.webkitFullscreenElement ||
              doc.mozFullScreenElement ||
              doc.msFullscreenElement
            ) {
              if (doc.exitFullscreen) void doc.exitFullscreen();
              else if (doc.webkitExitFullscreen)
                void doc.webkitExitFullscreen();
              else if (doc.mozCancelFullScreen) void doc.mozCancelFullScreen();
              else if (doc.msExitFullscreen) void doc.msExitFullscreen();
            } else {
              if (el.requestFullscreen) void el.requestFullscreen();
              else if (el.webkitRequestFullscreen)
                void el.webkitRequestFullscreen();
              else if (el.mozRequestFullScreen) void el.mozRequestFullScreen();
              else if (el.msRequestFullscreen) void el.msRequestFullscreen();
            }
            setOverlayOpen(false);
          }}
          aria-label="Toggle fullscreen"
          title="Toggle fullscreen"
        >
          <Maximize className="h-4 w-4" />
        </Button>
        {activeUrl ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="border-red-500 hover:border-red-600"
            onClick={() => {
              if (confirm("Exit game and return to arcade?")) {
                controller.sendSystemCommand("exit");
                setOverlayOpen(false);
              }
            }}
            aria-label="Exit game"
            title="Exit game"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        ) : null}
      </div>
    </header>
  );

  const closedChrome = (
    <header
      className={cn(
        "pointer-events-none fixed top-0 right-0 left-0 z-50 flex w-full shrink-0 items-center px-3 pb-2",
        topChromePadding,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center pr-2 pl-1">
        <div className="pointer-events-auto min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-muted-foreground text-[9px] font-medium tracking-[0.2em] uppercase">
              Room
            </p>
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                statusDotClass,
              )}
              aria-hidden
            />
          </div>
          <p
            className="truncate text-base leading-tight font-semibold tracking-wide tabular-nums"
            title={displayedRoomId ?? undefined}
          >
            {displayedRoomId ?? "—"}
          </p>
        </div>
      </div>

      <div className="w-[96px] shrink-0" />

      <div className="flex min-w-0 flex-1 justify-end gap-2 pl-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="bg-background/50 pointer-events-auto backdrop-blur-sm"
          onClick={() => emitArcadeAction("airjam.arcade.toggle_qr")}
          aria-label="Toggle host join QR"
          title="Toggle host join QR"
        >
          <QrCode className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="bg-background/50 pointer-events-auto backdrop-blur-sm"
          onClick={() => {
            const doc = document as DocumentWithFullscreen;
            const root = document.documentElement;
            if (!root) return;
            const el = root as ElementWithFullscreen;

            if (
              doc.fullscreenElement ||
              doc.webkitFullscreenElement ||
              doc.mozFullScreenElement ||
              doc.msFullscreenElement
            ) {
              if (doc.exitFullscreen) void doc.exitFullscreen();
              else if (doc.webkitExitFullscreen)
                void doc.webkitExitFullscreen();
              else if (doc.mozCancelFullScreen) void doc.mozCancelFullScreen();
              else if (doc.msExitFullscreen) void doc.msExitFullscreen();
            } else {
              if (el.requestFullscreen) void el.requestFullscreen();
              else if (el.webkitRequestFullscreen)
                void el.webkitRequestFullscreen();
              else if (el.mozRequestFullScreen) void el.mozRequestFullScreen();
              else if (el.msRequestFullscreen) void el.msRequestFullscreen();
            }
          }}
          aria-label="Toggle fullscreen"
          title="Toggle fullscreen"
        >
          <Maximize className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );

  return (
    <>
      {!overlayOpen && !activeUrl ? closedChrome : null}

      <ControllerMenuNotch
        position="fixed"
        placement={notchPlacement}
        className={cn("z-60", notchOffsetClass)}
        strokeClassName="stroke-zinc-700"
        pulse={connectionNotchPulse}
        onClick={toggleOverlay}
        aria-label={overlayOpen ? "Close menu" : "Open controller menu"}
        title={`Connection: ${connectionLabel}`}
      >
        <div className="relative flex size-full items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            {overlayOpen ? (
              <motion.div
                key="close"
                initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                transition={{ duration: 0.15 }}
                className="absolute flex items-center justify-center"
              >
                <X
                  className="text-foreground size-4 shrink-0"
                  strokeWidth={2.5}
                  aria-hidden
                />
              </motion.div>
            ) : (
              <motion.div
                key="logo"
                initial={{ opacity: 0, scale: 0.5, rotate: 90 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.5, rotate: -90 }}
                transition={{ duration: 0.15 }}
                className="absolute flex items-center justify-center"
              >
                <Image
                  src="/images/airjam-logo.png"
                  alt=""
                  width={64}
                  height={20}
                  className="h-4 w-auto object-contain"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ControllerMenuNotch>

      <AnimatePresence>
        {overlayOpen ? (
          <motion.div
            key="controller-overlay"
            className={cn("fixed inset-0 z-50 flex", overlayFrameClass)}
            initial={landscapeMenu ? { x: "100%" } : { y: "-100%" }}
            animate={landscapeMenu ? { x: 0 } : { y: 0 }}
            exit={landscapeMenu ? { x: "100%" } : { y: "-100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <div className={overlayPanelClass}>
              {overlayChrome}

              <div className={overlayBodyClass}>
                <div className="mx-auto flex max-w-md flex-col gap-8">
                  <section className="flex flex-col gap-3">
                    <h2 className="text-sm font-semibold tracking-wide uppercase">
                      Profile
                    </h2>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="aj-display-name">Display name</Label>
                      <Input
                        id="aj-display-name"
                        value={profileDraft.label}
                        onChange={(e) =>
                          setProfileDraft((d) => ({
                            ...d,
                            label: e.target.value,
                          }))
                        }
                        maxLength={24}
                        autoCapitalize="words"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-muted-foreground text-xs uppercase">
                        Avatar
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {CONTROLLER_AVATAR_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            className={`flex h-14 items-center justify-center rounded-lg border text-2xl ${
                              profileDraft.avatarId === preset.id
                                ? "border-primary ring-primary ring-2"
                                : "border-border/60"
                            }`}
                            onClick={() =>
                              setProfileDraft((d) => ({
                                ...d,
                                avatarId: preset.id,
                              }))
                            }
                          >
                            {preset.emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button type="button" onClick={() => void saveProfile()}>
                      Save profile
                    </Button>
                  </section>

                  <section className="flex flex-col gap-3">
                    <h2 className="text-sm font-semibold tracking-wide uppercase">
                      Room
                    </h2>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="aj-room-code">Room code</Label>
                      <Input
                        id="aj-room-code"
                        value={roomDraft}
                        onChange={(e) =>
                          setRoomDraft(
                            e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, ""),
                          )
                        }
                        maxLength={8}
                        autoCapitalize="characters"
                        inputMode="text"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={applyRoom}>
                        Apply room
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setScanning(true)}
                      >
                        <ScanLine className="mr-2 h-4 w-4" />
                        Scan QR
                      </Button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {scanning ? (
        <div className="fixed inset-0 z-70 flex flex-col bg-black/90 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Scan join QR</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setScanning(false)}
            >
              Cancel
            </Button>
          </div>
          <video
            ref={videoRef}
            className="mt-4 w-full flex-1 rounded-lg object-cover"
            controls={false}
            muted
            playsInline
          />
        </div>
      ) : null}
    </>
  );
}
