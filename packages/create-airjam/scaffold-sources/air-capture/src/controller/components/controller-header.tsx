import type { PlayerProfile } from "@air-jam/sdk";
import { toShellMatchPhase } from "@air-jam/sdk";
import {
  LifecycleActionGroup,
  PlayerAvatar,
  RuntimeShellHeader,
  useControllerLifecycleIntents,
  useControllerLifecyclePermissions,
  useControllerShellStatus,
} from "@air-jam/sdk/ui";

export type ControllerConnectionStatus =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "disconnected"
  | "idle";

export type ControllerMatchPhase = "lobby" | "countdown" | "playing" | "ended";

export const ControllerHeader = ({
  myProfile,
  roomId,
  connectionStatus,
  matchPhase,
  runtimeState,
  canSendSystemCommand,
  canStartMatch,
  onTogglePause,
  onStartMatch,
  onRestartMatch,
  onReturnToLobby,
}: {
  myProfile: PlayerProfile | null | undefined;
  roomId: string | null;
  connectionStatus: ControllerConnectionStatus;
  matchPhase: ControllerMatchPhase;
  runtimeState?: "playing" | "paused";
  canSendSystemCommand: boolean;
  canStartMatch: boolean;
  onTogglePause: () => void;
  onStartMatch: () => void;
  onRestartMatch: () => void;
  onReturnToLobby: () => void;
}) => {
  const shellStatus = useControllerShellStatus({
    roomId,
    connectionStatus,
    playerLabel: myProfile?.label ?? null,
  });
  const shellPhase = toShellMatchPhase(matchPhase);
  const lifecyclePermissions = useControllerLifecyclePermissions({
    phase: shellPhase,
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
        <div className="flex min-w-0 items-center gap-2">
          {myProfile ? (
            <PlayerAvatar
              player={myProfile}
              size="sm"
              className="h-7 w-7 border-2"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-zinc-800 text-[10px] font-bold text-zinc-300">
              {shellStatus.identityInitial}
            </span>
          )}
          <div className="min-w-0">
            {shellStatus.hasIdentity ? (
              <div className="truncate text-sm font-semibold normal-case text-zinc-200">
                {shellStatus.displayName}
              </div>
            ) : null}
            <div className="text-xs font-semibold tracking-wider text-zinc-300 uppercase">
              {shellStatus.roomLine}
            </div>
          </div>
        </div>
      }
      rightSlot={
        <LifecycleActionGroup
          phase={shellPhase}
          runtimeState={runtimeState}
          canInteract={lifecyclePermissions.canInteractForPhase}
          onStart={lifecycleIntents.onStart}
          onTogglePause={lifecycleIntents.onTogglePause}
          onBackToLobby={lifecycleIntents.onBackToLobby}
          onRestart={lifecycleIntents.onRestart}
          startLabel="Start"
          restartLabel="Restart"
          backLabel="Lobby"
        />
      }
      className="border-white/10 bg-black/20 px-3 py-2 text-xs uppercase"
    />
  );
};
