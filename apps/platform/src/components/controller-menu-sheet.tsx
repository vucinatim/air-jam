"use client";

import { ControllerMenuNotch } from "@/components/controller-menu-notch";
import { PlatformSettingsPanel } from "@/components/platform-settings-panel";
import {
  platformShellUtilityButtonActiveClassName,
  platformShellUtilityButtonClassName,
} from "@/components/shell-classes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { triggerLocalHaptic } from "@/lib/local-haptics";
import { parseRoomFromQrText } from "@/lib/parse-room-from-qr-text";
import { toggleDocumentFullscreen } from "@/lib/use-document-fullscreen";
import { cn } from "@/lib/utils";
import {
  type AirJamControllerApi,
  type ControllerOrientation,
  type PlatformSettingsSnapshot,
  type PlayerProfile,
} from "@air-jam/sdk";
import { airJamArcadePlatformActions } from "@air-jam/sdk/protocol";
import { getDiceBearAdventurerNeutralUrl, PlayerAvatar } from "@air-jam/sdk/ui";
import { LogOut, Maximize, QrCode, ScanLine, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

const controllerMenuHeaderButtonClassName = cn(
  "rounded-2xl",
  platformShellUtilityButtonClassName,
);

const controllerMenuHeaderButtonActiveClassName = cn(
  "rounded-2xl",
  platformShellUtilityButtonActiveClassName,
);

const controllerMenuSectionClassName =
  "rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";

const controllerMenuPrimaryButtonClassName =
  "w-full rounded-2xl border border-white/10 bg-white text-black hover:bg-white/92";

const controllerMenuSecondaryButtonClassName = cn(
  "w-full rounded-2xl",
  platformShellUtilityButtonClassName,
);

interface ControllerMenuSheetProps {
  routeRoomId: string | null;
  activeUrl: string | null;
  controller: AirJamControllerApi;
  emitArcadeAction: (action: string) => void;
  controllerOrientation: ControllerOrientation;
  documentFullscreen: boolean;
  /** Host arcade join QR overlay is visible (replicated `ArcadeSurfaceState.overlay === "qr"`). */
  hostQrVisible: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  sharedPlatformSettings: PlatformSettingsSnapshot | null;
  onUpdateSharedPlatformSettings: (patch: {
    audio?: Partial<PlatformSettingsSnapshot["audio"]>;
    accessibility?: Partial<PlatformSettingsSnapshot["accessibility"]>;
    feedback?: Partial<PlatformSettingsSnapshot["feedback"]>;
  }) => void;
}

/** Shared top-left: avatar + “Room” label, status dot, room code (sheet + floating bar). */
const ControllerMenuLeadingChrome = ({
  selfProfileForAvatar,
  displayedRoomId,
  statusDotClass,
  /** Parent uses `pointer-events-none` (floating bar); re-enable hits on this block. */
  pointerEventsAuto,
}: {
  selfProfileForAvatar: PlayerProfile | null;
  displayedRoomId: string | null;
  statusDotClass: string;
  pointerEventsAuto?: boolean;
}) => (
  <div
    className={cn(
      "flex min-w-0 flex-1 items-center gap-2.5 pr-2 pl-1",
      pointerEventsAuto && "pointer-events-auto",
    )}
  >
    {selfProfileForAvatar ? (
      <PlayerAvatar
        player={selfProfileForAvatar}
        size="sm"
        className="ring-border h-10! w-10! shrink-0 ring-2"
      />
    ) : null}
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <p className="text-[9px] font-semibold tracking-[0.2em] text-white/48 uppercase">
          Room
        </p>
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDotClass)}
          aria-hidden
        />
      </div>
      <p
        className="truncate text-[15px] leading-tight font-semibold tracking-[0.08em] text-white tabular-nums"
        title={displayedRoomId ?? undefined}
      >
        {displayedRoomId ?? "—"}
      </p>
    </div>
  </div>
);

export function ControllerMenuSheet({
  routeRoomId,
  activeUrl,
  controller,
  emitArcadeAction,
  controllerOrientation,
  documentFullscreen,
  hostQrVisible,
  hapticsEnabled,
  reducedMotion,
  highContrast,
  sharedPlatformSettings,
  onUpdateSharedPlatformSettings,
}: ControllerMenuSheetProps) {
  const router = useRouter();

  const localProfile = useSyncExternalStore(
    subscribeControllerLocalProfile,
    getControllerLocalProfileClientSnapshot,
    getControllerLocalProfileServerSnapshot,
  );

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [exitGameConfirmOpen, setExitGameConfirmOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ControllerPersistedProfile>({
    label: "",
    avatarId: "",
  });
  const [roomDraft, setRoomDraft] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saveProfileSuccess, setSaveProfileSuccess] = useState(false);
  const [applyRoomSuccess, setApplyRoomSuccess] = useState(false);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const applySuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const applyNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    return () => {
      if (saveSuccessTimerRef.current) {
        clearTimeout(saveSuccessTimerRef.current);
      }
      if (applySuccessTimerRef.current) {
        clearTimeout(applySuccessTimerRef.current);
      }
      if (applyNavTimerRef.current) {
        clearTimeout(applyNavTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeUrl) {
      startTransition(() => {
        setExitGameConfirmOpen(false);
      });
    }
  }, [activeUrl]);

  const displayedRoomId = controller.roomId ?? routeRoomId;

  const selfProfileForAvatar = useMemo((): PlayerProfile | null => {
    if (controller.selfPlayer) {
      return controller.selfPlayer;
    }
    if (controller.controllerId) {
      return {
        id: controller.controllerId,
        label: localProfile.label || "Player",
        avatarId: localProfile.avatarId,
      };
    }
    if (localProfile.avatarId) {
      return {
        id: "preview",
        label: localProfile.label || "Player",
        avatarId: localProfile.avatarId,
      };
    }
    return null;
  }, [
    controller.controllerId,
    controller.selfPlayer,
    localProfile.avatarId,
    localProfile.label,
  ]);

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
      setProfileDraft({
        label: controller.selfPlayer?.label ?? localProfile.label,
        avatarId: controller.selfPlayer?.avatarId ?? localProfile.avatarId,
      });
      setRoomDraft(displayedRoomId ?? "");
    }
    setOverlayOpen((prev) => !prev);
  }, [controller.selfPlayer, displayedRoomId, localProfile, overlayOpen]);

  const applyRoom = useCallback(() => {
    const code = roomDraft
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (code.length < 4) {
      return;
    }

    if (applySuccessTimerRef.current) {
      clearTimeout(applySuccessTimerRef.current);
    }
    if (applyNavTimerRef.current) {
      clearTimeout(applyNavTimerRef.current);
    }

    // If we're already in a room, disconnect first
    if (controller.roomId && controller.roomId !== code) {
      controller.socket?.disconnect();
    }

    setApplyRoomSuccess(true);
    applyNavTimerRef.current = setTimeout(() => {
      applyNavTimerRef.current = null;
      router.replace(`/controller?room=${encodeURIComponent(code)}`);
    }, 550);
    applySuccessTimerRef.current = setTimeout(() => {
      applySuccessTimerRef.current = null;
      setApplyRoomSuccess(false);
    }, 2800);
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
    const ack = await controller.updatePlayerProfile(toProfilePatch(next));
    if (!ack.ok) {
      return;
    }
    if (saveSuccessTimerRef.current) {
      clearTimeout(saveSuccessTimerRef.current);
    }
    setSaveProfileSuccess(true);
    saveSuccessTimerRef.current = setTimeout(() => {
      saveSuccessTimerRef.current = null;
      setSaveProfileSuccess(false);
    }, 2600);
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

  const topChromeStyle: CSSProperties | undefined = documentFullscreen
    ? undefined
    : { paddingTop: "max(0.5rem, env(safe-area-inset-top))" };
  const notchPlacement =
    activeUrl && controllerOrientation === "landscape" ? "right" : "top";
  const landscapeMenu = notchPlacement === "right";
  const notchOffsetStyle: CSSProperties | undefined = documentFullscreen
    ? undefined
    : landscapeMenu
      ? { marginRight: "env(safe-area-inset-right)" }
      : { marginTop: "env(safe-area-inset-top)" };
  const overlayFrameClass = landscapeMenu
    ? cn(
        "items-stretch justify-end backdrop-blur-md",
        highContrast ? "bg-black/84" : "bg-black/68",
      )
    : highContrast
      ? "flex-col bg-black"
      : "flex-col bg-black/82 backdrop-blur-md";
  const overlayPanelClass = landscapeMenu
    ? cn(
        "flex h-full w-full max-w-md flex-col shadow-2xl backdrop-blur-xl",
        highContrast
          ? "border-l border-white/20 bg-zinc-950"
          : "border-l border-white/10 bg-zinc-950/96",
      )
    : cn(
        "flex h-full w-full flex-col backdrop-blur-xl",
        highContrast
          ? "border-t border-white/15 bg-zinc-950"
          : "border-t border-white/10 bg-zinc-950/96",
      );
  const overlayBodyClass = landscapeMenu
    ? "min-h-0 flex-1 overflow-y-auto px-4 py-5"
    : "min-h-0 flex-1 overflow-y-auto px-4 py-5";
  const notchIconTransition = reducedMotion
    ? { duration: 0.01 }
    : { duration: 0.15 };
  const overlayTransition = reducedMotion
    ? { duration: 0.01 }
    : { type: "spring" as const, stiffness: 420, damping: 38 };

  const overlayChrome = (
    <header
      className="relative flex w-full shrink-0 items-center border-b border-white/10 px-3 pt-2 pb-2"
      style={topChromeStyle}
    >
      <span className="sr-only" aria-live="polite">
        {`Connection ${connectionLabel}`}
      </span>
      <ControllerMenuLeadingChrome
        selfProfileForAvatar={selfProfileForAvatar}
        displayedRoomId={displayedRoomId}
        statusDotClass={statusDotClass}
      />

      {/* Empty space for the fixed notch to sit over */}
      {!landscapeMenu ? <div className="w-[96px] shrink-0" /> : null}

      <div className="flex min-w-0 flex-1 justify-end gap-2 pl-2">
        <Button
          type="button"
          variant="outline"
          size="icon-touch"
          className={
            hostQrVisible
              ? controllerMenuHeaderButtonActiveClassName
              : controllerMenuHeaderButtonClassName
          }
          onClick={() => {
            if (hapticsEnabled) triggerLocalHaptic("selection");
            emitArcadeAction(airJamArcadePlatformActions.toggleQr);
          }}
          aria-label={hostQrVisible ? "Hide host join QR" : "Show host join QR"}
          title={hostQrVisible ? "Hide host join QR" : "Show host join QR"}
        >
          <QrCode className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-touch"
          className={controllerMenuHeaderButtonClassName}
          onClick={() => {
            void toggleDocumentFullscreen();
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
            size="icon-touch"
            className="rounded-2xl border-red-400/24 bg-red-500/8 text-red-100 hover:border-red-300/32 hover:bg-red-500/14"
            onClick={() => setExitGameConfirmOpen(true)}
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
      className="pointer-events-none fixed top-0 right-0 left-0 z-50 flex w-full shrink-0 items-center px-3 pt-2 pb-2"
      style={topChromeStyle}
    >
      <ControllerMenuLeadingChrome
        selfProfileForAvatar={selfProfileForAvatar}
        displayedRoomId={displayedRoomId}
        statusDotClass={statusDotClass}
        pointerEventsAuto
      />

      <div className="w-[96px] shrink-0" />

      <div className="flex min-w-0 flex-1 justify-end gap-2 pl-2">
        <Button
          type="button"
          variant="outline"
          size="icon-touch"
          className={cn(
            "pointer-events-auto",
            hostQrVisible
              ? controllerMenuHeaderButtonActiveClassName
              : controllerMenuHeaderButtonClassName,
          )}
          onClick={() => {
            if (hapticsEnabled) triggerLocalHaptic("selection");
            emitArcadeAction(airJamArcadePlatformActions.toggleQr);
          }}
          aria-label={hostQrVisible ? "Hide host join QR" : "Show host join QR"}
          title={hostQrVisible ? "Hide host join QR" : "Show host join QR"}
        >
          <QrCode className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-touch"
          className={cn(
            "pointer-events-auto",
            controllerMenuHeaderButtonClassName,
          )}
          onClick={() => {
            void toggleDocumentFullscreen();
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
      <AlertDialog
        open={exitGameConfirmOpen}
        onOpenChange={setExitGameConfirmOpen}
      >
        <AlertDialogContent
          overlayClassName="z-[70]"
          className="z-80 sm:max-w-md"
          data-testid="controller-exit-game-confirm"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Exit game?</AlertDialogTitle>
            <AlertDialogDescription>
              You will leave this game and return to the arcade menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex w-full flex-row flex-nowrap gap-3">
            <AlertDialogCancel className="h-14 min-h-14 flex-1 touch-manipulation rounded-xl text-base">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-14 min-h-14 flex-1 touch-manipulation rounded-xl bg-destructive text-base text-white hover:bg-destructive/90"
              onClick={() => {
                controller.sendSystemCommand("exit");
                setOverlayOpen(false);
              }}
            >
              Exit to arcade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!overlayOpen && !activeUrl ? closedChrome : null}

      <ControllerMenuNotch
        position="fixed"
        placement={notchPlacement}
        className="z-60"
        style={notchOffsetStyle}
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
                transition={notchIconTransition}
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
                transition={notchIconTransition}
                className="absolute flex items-center justify-center"
              >
                <motion.div
                  className="flex items-center justify-center"
                  initial={{ y: -2 }}
                  animate={{ y: [-2, 2] }}
                  transition={{
                    repeat: Infinity,
                    repeatType: "reverse",
                    duration: 1.375,
                    ease: "easeInOut",
                  }}
                >
                  <Image
                    src="/images/airjam-logo.png"
                    alt=""
                    width={64}
                    height={20}
                    className="h-4 w-auto object-contain"
                  />
                </motion.div>
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
            initial={
              reducedMotion
                ? { opacity: 0 }
                : landscapeMenu
                  ? { x: "100%" }
                  : { y: "-100%" }
            }
            animate={
              reducedMotion
                ? { opacity: 1 }
                : landscapeMenu
                  ? { x: 0 }
                  : { y: 0 }
            }
            exit={
              reducedMotion
                ? { opacity: 0 }
                : landscapeMenu
                  ? { x: "100%" }
                  : { y: "-100%" }
            }
            transition={overlayTransition}
          >
            <div className={overlayPanelClass}>
              {overlayChrome}

              <div className={overlayBodyClass}>
                <div className="mx-auto flex max-w-md flex-col gap-4">
                  <section className={cn("flex flex-col gap-3", controllerMenuSectionClassName)}>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold tracking-[0.18em] text-white/48 uppercase">
                        Profile
                      </p>
                      <p className="text-sm leading-6 text-white/62">
                        Choose how your controller shows up in the room.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="aj-display-name" className="text-white/74">
                        Display name
                      </Label>
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
                      <Label className="text-white/74">Avatar</Label>
                      <div
                        className="flex gap-2 overflow-x-auto px-2 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        role="group"
                        aria-label="Avatar"
                      >
                        {CONTROLLER_AVATAR_PRESETS.map((preset) => {
                          const src = getDiceBearAdventurerNeutralUrl(
                            preset.seed,
                          );
                          const selected = profileDraft.avatarId === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              aria-pressed={selected}
                              className={cn(
                                "h-14 w-14 shrink-0 rounded-2xl border p-0 transition-colors",
                                selected
                                  ? "border-white/22 bg-white/[0.08] ring-2 ring-white/18 ring-offset-2 ring-offset-black"
                                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                              )}
                              onClick={() =>
                                setProfileDraft((d) => ({
                                  ...d,
                                  avatarId: preset.id,
                                }))
                              }
                            >
                              <span className="block size-full overflow-hidden rounded-[10px]">
                                {/* eslint-disable-next-line @next/next/no-img-element -- DiceBear SVG */}
                                <img
                                  src={src}
                                  alt=""
                                  width={56}
                                  height={56}
                                  className="size-full object-cover"
                                  draggable={false}
                                />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="touch"
                      className={controllerMenuPrimaryButtonClassName}
                      disabled={saveProfileSuccess}
                      onClick={() => {
                        if (hapticsEnabled) triggerLocalHaptic("action");
                        void saveProfile();
                      }}
                    >
                      <span className="relative grid min-h-[1.25em] w-full place-items-center">
                        <AnimatePresence mode="wait" initial={false}>
                          {saveProfileSuccess ? (
                            <motion.span
                              key="saved"
                              initial={{
                                opacity: 0,
                                y: 10,
                                filter: "blur(4px)",
                              }}
                              animate={{
                                opacity: 1,
                                y: 0,
                                filter: "blur(0px)",
                              }}
                              exit={{ opacity: 0, y: -8 }}
                              transition={{
                                type: "spring",
                                stiffness: 420,
                                damping: 32,
                              }}
                              className="text-primary-foreground col-start-1 row-start-1 font-semibold"
                            >
                              Saved!
                            </motion.span>
                          ) : (
                            <motion.span
                              key="save"
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 6 }}
                              transition={{ duration: 0.18 }}
                              className="col-start-1 row-start-1"
                            >
                              Save profile
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                    </Button>
                  </section>

                  <section className={cn("flex flex-col gap-3", controllerMenuSectionClassName)}>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold tracking-[0.18em] text-white/48 uppercase">
                        Room
                      </p>
                      <p className="text-sm leading-6 text-white/62">
                        Join another room directly or scan a phone QR code.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="aj-room-code" className="text-white/74">
                        Room code
                      </Label>
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
                    <div className="flex w-full flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="touch"
                        className={controllerMenuSecondaryButtonClassName}
                        disabled={applyRoomSuccess}
                        onClick={() => {
                          if (hapticsEnabled) triggerLocalHaptic("action");
                          applyRoom();
                        }}
                      >
                        <span className="relative grid min-h-[1.25em] w-full place-items-center">
                          <AnimatePresence mode="wait" initial={false}>
                            {applyRoomSuccess ? (
                              <motion.span
                                key="applied"
                                initial={{
                                  opacity: 0,
                                  y: 10,
                                  filter: "blur(4px)",
                                }}
                                animate={{
                                  opacity: 1,
                                  y: 0,
                                  filter: "blur(0px)",
                                }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 420,
                                  damping: 32,
                                }}
                                className="text-foreground col-start-1 row-start-1 font-semibold"
                              >
                                Applied!
                              </motion.span>
                            ) : (
                              <motion.span
                                key="apply"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                transition={{ duration: 0.18 }}
                                className="col-start-1 row-start-1"
                              >
                                Apply room
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="touch"
                        className={controllerMenuSecondaryButtonClassName}
                        onClick={() => {
                          if (hapticsEnabled) triggerLocalHaptic("action");
                          setScanning(true);
                        }}
                      >
                        <ScanLine className="mr-2 h-4 w-4" />
                        Scan QR
                      </Button>
                    </div>
                  </section>

                  {sharedPlatformSettings ? (
                    <PlatformSettingsPanel
                      className="rounded-[1.5rem] border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                      settings={sharedPlatformSettings}
                      onUpdateAudio={(audio) =>
                        onUpdateSharedPlatformSettings({ audio })
                      }
                      onUpdateAccessibility={(accessibility) =>
                        onUpdateSharedPlatformSettings({ accessibility })
                      }
                      onUpdateFeedback={(feedback) =>
                        onUpdateSharedPlatformSettings({ feedback })
                      }
                    />
                  ) : (
                    <PlatformSettingsPanel className="rounded-[1.5rem] border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]" />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {scanning ? (
        <div className="fixed inset-0 z-70 flex flex-col bg-black/90 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">Scan join QR</p>
            <Button
              type="button"
              variant="ghost"
              size="touch"
              className="rounded-2xl text-white/80 hover:bg-white/[0.08] hover:text-white"
              onClick={() => setScanning(false)}
            >
              Cancel
            </Button>
          </div>
          <video
            ref={videoRef}
            className="mt-4 w-full flex-1 rounded-[1.5rem] border border-white/10 object-cover"
            controls={false}
            muted
            playsInline
          />
        </div>
      ) : null}
    </>
  );
}
