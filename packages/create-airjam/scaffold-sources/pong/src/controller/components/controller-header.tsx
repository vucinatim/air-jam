import type { AirJamControllerApi } from "@air-jam/sdk";
import { PlayerAvatar } from "@air-jam/sdk/ui";
import type { PlayerProfile } from "@air-jam/sdk/protocol";

interface ControllerHeaderProps {
  roomId: AirJamControllerApi["roomId"];
  myProfile: PlayerProfile | null;
  connectionStatus: AirJamControllerApi["connectionStatus"];
  matchPhase: "lobby" | "playing" | "ended";
  runtimeState: AirJamControllerApi["runtimeState"];
  canSendSystemCommand: boolean;
  onTogglePause: () => void;
  onReturnToLobby: () => void;
}

const statusDotByConnection = {
  connected: "bg-emerald-300",
  connecting: "bg-amber-300",
  reconnecting: "bg-amber-300",
  disconnected: "bg-rose-300",
  idle: "bg-zinc-500",
} as const;

export const ControllerHeader = ({
  roomId,
  myProfile,
  connectionStatus,
  matchPhase,
  runtimeState,
  canSendSystemCommand,
  onTogglePause,
  onReturnToLobby,
}: ControllerHeaderProps) => {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase">
      <div className="flex min-w-0 items-center gap-3">
        {myProfile ? (
          <PlayerAvatar
            player={myProfile}
            size="sm"
            className="h-10 w-10 border-2 ring-2 ring-white/12"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-zinc-800/90 text-[10px] font-bold text-zinc-300">
            ME
          </span>
        )}
        <div className="min-w-0">
          {myProfile ? (
            <div className="truncate text-sm font-semibold normal-case text-zinc-100">
              {myProfile.label}
            </div>
          ) : null}
          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotByConnection[connectionStatus]}`}
              aria-hidden
            />
            <div className="text-[0.8rem] leading-tight font-semibold tracking-[0.22em] text-zinc-300 tabular-nums">
              {roomId ?? "----"}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {matchPhase === "playing" ? (
          <>
            <button
              type="button"
              className="rounded-full border border-white/14 bg-white/6 px-3 py-2 text-[10px] font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSendSystemCommand}
              onClick={onTogglePause}
            >
              {runtimeState === "playing" ? "Pause" : "Resume"}
            </button>
            <button
              type="button"
              className="rounded-full border border-white/14 bg-white/6 px-3 py-2 text-[10px] font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSendSystemCommand}
              onClick={onReturnToLobby}
            >
              Lobby
            </button>
          </>
        ) : matchPhase === "ended" ? (
          <button
            type="button"
            className="rounded-full border border-white/14 bg-white/6 px-3 py-2 text-[10px] font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSendSystemCommand}
            onClick={onReturnToLobby}
          >
            Lobby
          </button>
        ) : null}
      </div>
    </header>
  );
};
