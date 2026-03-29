import type { AirJamControllerApi } from "@air-jam/sdk";
import { PlayerAvatar } from "@air-jam/sdk/ui";
import type { PlayerProfile } from "@air-jam/sdk/protocol";

interface ControllerHeaderProps {
  roomId: AirJamControllerApi["roomId"];
  myProfile: PlayerProfile | null;
  connectionStatus: AirJamControllerApi["connectionStatus"];
  matchPhase: "lobby" | "playing" | "ended";
  gameState: AirJamControllerApi["gameState"];
  canSendSystemCommand: boolean;
  onTogglePause: () => void;
  onReturnToLobby: () => void;
}

const statusColorByConnection = {
  connected: "text-emerald-300",
  connecting: "text-amber-300",
  reconnecting: "text-amber-300",
  disconnected: "text-rose-300",
  idle: "text-zinc-400",
} as const;

export const ControllerHeader = ({
  roomId,
  myProfile,
  connectionStatus,
  matchPhase,
  gameState,
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
            className="h-8 w-8 border-2"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-zinc-800/90 text-[10px] font-bold text-zinc-300">
            ME
          </span>
        )}
        <div className="min-w-0">
          {myProfile ? (
            <div className="truncate text-sm font-semibold normal-case text-zinc-100">
              {myProfile.label}
            </div>
          ) : null}
          <div className="pong-caption text-[0.62rem]">
            Room {roomId ?? "----"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`pong-status-pill px-3 py-2 ${statusColorByConnection[connectionStatus]}`}>
          <span className="pong-status-dot" />
          {connectionStatus}
        </span>
        {matchPhase === "playing" ? (
          <>
            <button
              type="button"
              className="rounded-full border border-white/14 bg-white/6 px-3 py-2 text-[10px] font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSendSystemCommand}
              onClick={onTogglePause}
            >
              {gameState === "playing" ? "Pause" : "Resume"}
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
