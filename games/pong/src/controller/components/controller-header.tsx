import type { AirJamControllerApi } from "@air-jam/sdk";
import {
  LifecycleActionGroup,
  PlayerAvatar,
  RuntimeShellHeader,
  useControllerLifecycleIntents,
  useControllerLifecyclePermissions,
  useControllerShellStatus,
} from "@air-jam/sdk/ui";
import type { PlayerProfile } from "@air-jam/sdk/protocol";

interface ControllerHeaderProps {
  roomId: AirJamControllerApi["roomId"];
  myProfile: PlayerProfile | null;
  connectionStatus: AirJamControllerApi["connectionStatus"];
  matchPhase: "lobby" | "playing" | "ended";
  runtimeState: AirJamControllerApi["runtimeState"];
  canSendSystemCommand: boolean;
  canStartMatch: boolean;
  onTogglePause: () => void;
  onReturnToLobby: () => void;
  onStartMatch: () => void;
  onRestartMatch: () => void;
}

export const ControllerHeader = ({
  roomId,
  myProfile,
  connectionStatus,
  matchPhase,
  runtimeState,
  canSendSystemCommand,
  canStartMatch,
  onTogglePause,
  onReturnToLobby,
  onStartMatch,
  onRestartMatch,
}: ControllerHeaderProps) => {
  const shellStatus = useControllerShellStatus({
    roomId,
    connectionStatus,
    playerLabel: myProfile?.label ?? null,
  });
  const lifecyclePermissions = useControllerLifecyclePermissions({
    phase: matchPhase,
    canStartMatch,
    canSendSystemCommand,
  });
  const lifecycleIntents = useControllerLifecycleIntents({
    onStart: onStartMatch,
    onTogglePause,
    onBackToLobby: onReturnToLobby,
    onRestart: onRestartMatch,
  });

  return (
    <RuntimeShellHeader
      connectionStatus={connectionStatus}
      leftSlot={
        <div className="flex min-w-0 items-center gap-2.5">
          {myProfile ? (
            <PlayerAvatar
              player={myProfile}
              size="sm"
              className="h-9 w-9 border-2 ring-2 ring-white/12"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-zinc-800/90 text-[10px] font-bold text-zinc-300">
              {shellStatus.identityInitial}
            </span>
          )}
          <div className="min-w-0 space-y-0.5">
            {shellStatus.hasIdentity ? (
              <div className="truncate text-[15px] leading-tight font-semibold normal-case text-zinc-100">
                {shellStatus.displayName}
              </div>
            ) : null}
            <div className="text-[11px] leading-tight font-semibold tracking-[0.2em] text-zinc-300 tabular-nums sm:text-[12px]">
              {shellStatus.roomLine}
            </div>
          </div>
        </div>
      }
      rightSlot={
        matchPhase === "lobby" ? null : (
          <LifecycleActionGroup
            phase={matchPhase}
            runtimeState={runtimeState}
            canInteract={lifecyclePermissions.canInteractForPhase}
            onStart={lifecycleIntents.onStart}
            onTogglePause={lifecycleIntents.onTogglePause}
            onBackToLobby={lifecycleIntents.onBackToLobby}
            onRestart={lifecycleIntents.onRestart}
            restartLabel="Play Again"
            className="gap-1.5"
            buttonClassName="h-7 px-2.5 text-[8px] tracking-[0.1em] sm:h-8 sm:px-3 sm:text-[9px] sm:tracking-[0.12em]"
          />
        )
      }
      className="border-white/10 bg-black/35 px-3 py-2 text-xs uppercase sm:px-3.5"
    />
  );
};
