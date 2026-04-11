"use client";

import { Button } from "@/components/ui/button";
import {
  platformShellBarClassName,
  platformShellInsetClassName,
  platformShellUtilityButtonActiveClassName,
  platformShellUtilityButtonClassName,
} from "@/components/shell-classes";
import { cn } from "@/lib/utils";
import type { PlayerProfile } from "@air-jam/sdk";
import { PlayerAvatarStrip } from "@air-jam/sdk/ui";
import {
  Maximize,
  Minimize2,
  QrCode,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import Image from "next/image";

interface ArcadeChromeProps {
  roomId?: string;
  players: PlayerProfile[];
  connectionStatus:
    | "idle"
    | "connecting"
    | "connected"
    | "disconnected"
    | "reconnecting";
  lastError?: string;
  qrVisible: boolean;
  settingsVisible: boolean;
  documentFullscreen: boolean;
  onToggleQr: () => void;
  onToggleSettings: () => void;
  onToggleFullscreen: () => void;
  className?: string;
  /** When false, the game list is scrolled down — show bar background and border. */
  listAtTop: boolean;
  highContrast?: boolean;
}

export const ArcadeChrome = ({
  roomId,
  players,
  connectionStatus,
  lastError,
  qrVisible,
  settingsVisible,
  documentFullscreen,
  onToggleQr,
  onToggleSettings,
  onToggleFullscreen,
  className,
  listAtTop,
  highContrast = false,
}: ArcadeChromeProps) => {
  const showElevatedBar = !listAtTop;
  const utilityIconButtonClassName = cn(
    "size-9 shrink-0 rounded-xl p-0",
    platformShellUtilityButtonClassName,
  );

  return (
    <header
      className={cn(
        "px-4 py-2.5 transition-[background-color,backdrop-filter,border-color] duration-200 ease-out",
        showElevatedBar
          ? highContrast
            ? "border-b border-white/20 bg-black/92 backdrop-blur-md"
            : "border-b border-white/10 bg-black/80 backdrop-blur-md"
          : highContrast
            ? "border-b border-white/10"
            : "border-b border-transparent",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-[1.6rem] px-2 py-1.5",
          platformShellBarClassName,
          highContrast && "border-white/20",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 shrink-0 items-center rounded-[1.1rem] border border-white/10 bg-white/[0.045] px-3">
            <Image
              src="/images/airjam-logo.png"
              alt="Air Jam"
              width={160}
              height={40}
              className="h-6.5 w-auto shrink-0 object-contain"
              priority={false}
            />
          </div>
          <div
            className={cn(
              "min-w-0 px-3 py-2",
              platformShellInsetClassName,
            )}
            title={lastError ?? `Connection ${connectionStatus}`}
          >
            <span className="sr-only">{`Connection ${connectionStatus}. `}</span>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-white/50 uppercase">
                Room
              </p>
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  connectionStatus === "connected"
                    ? "bg-emerald-300"
                    : connectionStatus === "connecting" ||
                        connectionStatus === "reconnecting"
                      ? "bg-amber-300"
                      : connectionStatus === "idle"
                        ? "bg-white/45"
                        : "bg-rose-300",
                )}
                aria-hidden
              />
            </div>
            <p
              className="text-lg leading-tight font-semibold tracking-[0.08em] text-white tabular-nums"
              data-testid="arcade-room-code"
            >
              {roomId || "----"}
            </p>
            {lastError ? (
              <p className="max-w-[22rem] text-[11px] leading-tight text-rose-200/90">
                {lastError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={cn("hidden items-center gap-3 px-3 py-2 md:flex", platformShellInsetClassName)}
            aria-label={`${players.length} player${players.length === 1 ? "" : "s"} joined`}
          >
            <PlayerAvatarStrip
              players={players}
              size="sm"
              maxVisible={4}
              avatarClassName="ring-2 ring-black/95"
              overflowBadgeClassName="border-white/18 bg-slate-700/80 text-white ring-2 ring-black/95"
            />
            <div className="flex h-8 items-center gap-1.5 text-white/72">
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-sm leading-none font-medium text-white tabular-nums">
                {players.length}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={cn(
              utilityIconButtonClassName,
              settingsVisible
                ? platformShellUtilityButtonActiveClassName
                : platformShellUtilityButtonClassName,
            )}
            onClick={onToggleSettings}
            aria-label={settingsVisible ? "Hide settings" : "Show settings"}
            title={settingsVisible ? "Hide settings" : "Show settings"}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={cn(
              utilityIconButtonClassName,
              documentFullscreen
                ? platformShellUtilityButtonActiveClassName
                : platformShellUtilityButtonClassName,
            )}
            onClick={onToggleFullscreen}
            aria-label={documentFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={documentFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {documentFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 shrink-0 gap-1.5 rounded-xl px-3 text-xs font-medium",
              qrVisible
                ? platformShellUtilityButtonActiveClassName
                : platformShellUtilityButtonClassName,
            )}
            onClick={onToggleQr}
            aria-label={qrVisible ? "Hide join QR" : "Show join QR"}
            title={qrVisible ? "Hide join QR" : "Show join QR"}
          >
            <QrCode className="h-4 w-4" />
            {qrVisible ? "Hide QR" : "Show QR"}
          </Button>
        </div>
      </div>
    </header>
  );
};
