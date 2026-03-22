"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pause, Play, Users } from "lucide-react";

interface ArcadeChromePlayer {
  id: string;
  label?: string;
}

interface ArcadeChromeProps {
  roomId?: string;
  players: ArcadeChromePlayer[];
  gameState: "paused" | "playing";
  connectionStatus:
    | "idle"
    | "connecting"
    | "connected"
    | "disconnected"
    | "reconnecting";
  onTogglePause: () => void;
  className?: string;
}

const statusClasses: Record<ArcadeChromeProps["connectionStatus"], string> = {
  connected: "bg-emerald-400",
  connecting: "bg-amber-300",
  reconnecting: "bg-amber-300",
  disconnected: "bg-rose-400",
  idle: "bg-slate-500",
};

export const ArcadeChrome = ({
  roomId,
  players,
  gameState,
  connectionStatus,
  onTogglePause,
  className,
}: ArcadeChromeProps) => {
  return (
    <header
      className={cn(
        "border-b border-white/10 bg-black/80 px-4 py-2 backdrop-blur",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              statusClasses[connectionStatus],
            )}
            aria-label={`Connection ${connectionStatus}`}
            title={`Connection ${connectionStatus}`}
          />
          <div>
            <p className="text-[11px] tracking-[0.18em] text-slate-400 uppercase">
              Room
            </p>
            <p className="text-lg leading-tight font-semibold text-white">
              {roomId || "----"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1">
            <Users className="h-4 w-4 text-slate-300" />
            <span className="text-sm font-medium text-slate-100">
              {players.length}
            </span>
            <div className="flex items-center -space-x-2 pl-1">
              {players.slice(0, 4).map((player) => {
                const label = player.label?.trim() || "P";
                return (
                  <div
                    key={player.id}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-slate-800 text-[10px] font-semibold text-white"
                    title={label}
                  >
                    {label.slice(0, 1).toUpperCase()}
                  </div>
                );
              })}
              {players.length > 4 && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-slate-700 text-[10px] font-semibold text-white">
                  +{players.length - 4}
                </div>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 border-white/20 bg-black/20 text-white hover:bg-white/10"
            onClick={onTogglePause}
            aria-label={gameState === "playing" ? "Pause game" : "Resume game"}
            title={gameState === "playing" ? "Pause game" : "Resume game"}
          >
            {gameState === "playing" ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
};
