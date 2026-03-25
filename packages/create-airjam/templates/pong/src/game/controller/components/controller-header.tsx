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
    <header className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs uppercase">
      <div className="flex items-center gap-2">
        {myProfile ? (
          <PlayerAvatar
            player={myProfile}
            size="sm"
            className="h-7 w-7 border-2"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-zinc-800 text-[10px] font-bold text-zinc-300">
            ME
          </span>
        )}
        <span>
          {myProfile ? (
            <span className="mr-2 font-semibold normal-case text-zinc-200">
              {myProfile.label}
            </span>
          ) : null}
          Room{" "}
          <span className="font-semibold tracking-wider">
            {roomId ?? "----"}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={statusColorByConnection[connectionStatus]}>
          {connectionStatus}
        </span>
        {matchPhase === "playing" ? (
          <>
            <button
              type="button"
              className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSendSystemCommand}
              onClick={onTogglePause}
            >
              {gameState === "playing" ? "Pause" : "Resume"}
            </button>
            <button
              type="button"
              className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSendSystemCommand}
              onClick={onReturnToLobby}
            >
              Lobby
            </button>
          </>
        ) : matchPhase === "ended" ? (
          <button
            type="button"
            className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
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
