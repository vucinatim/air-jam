"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlayerProfile } from "@air-jam/sdk";
import { PlayerAvatarStrip } from "@air-jam/sdk/ui";
import { QrCode, SlidersHorizontal, Users } from "lucide-react";
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
  onToggleQr: () => void;
  onToggleSettings: () => void;
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
  onToggleQr,
  onToggleSettings,
  className,
  listAtTop,
  highContrast = false,
}: ArcadeChromeProps) => {
  const showElevatedBar = !listAtTop;

  return (
    <header
      className={cn(
        "px-4 py-2 transition-[background-color,backdrop-filter,border-color] duration-200 ease-out",
        showElevatedBar
          ? highContrast
            ? "border-b border-white/20 bg-black/90 backdrop-blur-md"
            : "border-b border-white/10 bg-black/80 backdrop-blur-md"
          : highContrast
            ? "border-b border-white/10"
            : "border-b border-transparent",
        className,
      )}
    >
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image
            src="/images/airjam-logo.png"
            alt="Air Jam"
            width={160}
            height={40}
            className="h-7 w-auto shrink-0 object-contain"
            priority={false}
          />
          <div title={lastError ?? `Connection ${connectionStatus}`}>
            <span className="sr-only">{`Connection ${connectionStatus}. `}</span>
            <p className="text-[11px] tracking-[0.18em] text-slate-400 uppercase">
              Room
            </p>
            <p
              className="text-lg leading-tight font-semibold text-white"
              data-testid="arcade-room-code"
            >
              {roomId || "----"}
            </p>
            {lastError ? (
              <p className="max-w-[22rem] text-[11px] leading-tight text-rose-300">
                {lastError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex h-8 items-center gap-3">
          <div
            className="flex h-8 items-center gap-3"
            aria-label={`${players.length} player${players.length === 1 ? "" : "s"} joined`}
          >
            <PlayerAvatarStrip
              players={players}
              size="sm"
              maxVisible={4}
              avatarClassName="ring-2 ring-black/90"
              overflowBadgeClassName="border-white/25 bg-slate-700 text-white ring-2 ring-black/90"
            />
            <div className="flex h-8 items-center gap-1.5 text-slate-300">
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-sm leading-none font-medium text-slate-100 tabular-nums">
                {players.length}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant={settingsVisible ? "default" : "outline"}
            className="h-8 w-10 shrink-0 gap-1 border-white/20 bg-black/20 px-0 text-xs text-white hover:bg-white/10"
            onClick={onToggleSettings}
            aria-label={settingsVisible ? "Hide settings" : "Show settings"}
            title={settingsVisible ? "Hide settings" : "Show settings"}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-8 w-24 shrink-0 gap-1 border-white/20 bg-black/20 px-2 text-xs text-white hover:bg-white/10"
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
