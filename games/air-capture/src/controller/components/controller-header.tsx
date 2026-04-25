import type { PlayerProfile } from "@air-jam/sdk";
import { toShellMatchPhase } from "@air-jam/sdk";
import {
  LifecycleActionGroup,
  PlayerAvatar,
  RuntimeShellHeader,
  useControllerLifecycleIntents,
  useControllerLifecyclePermissions,
  useControllerShellStatus,
  type LifecycleActionKind,
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
  const utilityKinds: LifecycleActionKind[] =
    matchPhase === "playing" || matchPhase === "countdown"
      ? ["pause-toggle", "back-to-lobby"]
      : matchPhase === "ended"
        ? ["restart", "back-to-lobby"]
        : [];

  return (
    <RuntimeShellHeader
      connectionStatus={connectionStatus}
      leftSlot={
        <div className="flex min-w-0 items-center gap-2.5">
          {myProfile ? (
            <PlayerAvatar
              player={myProfile}
              size="sm"
              className="h-10 w-10 border-2"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-zinc-800 text-[0.6875rem] font-bold text-zinc-300">
              {shellStatus.identityInitial}
            </span>
          )}
          <div className="min-w-0">
            {shellStatus.hasIdentity ? (
              <div className="truncate text-sm font-semibold text-zinc-200 normal-case">
                {shellStatus.displayName}
              </div>
            ) : null}
            <div className="text-[0.625rem] font-semibold tracking-[0.18em] text-zinc-300 uppercase sm:text-[0.6875rem]">
              {shellStatus.roomLine}
            </div>
          </div>
        </div>
      }
      rightSlot={
        utilityKinds.length > 0 ? (
          <LifecycleActionGroup
            phase={shellPhase}
            runtimeState={runtimeState}
            canInteract={lifecyclePermissions.canInteractForPhase}
            onStart={lifecycleIntents.onStart}
            onTogglePause={lifecycleIntents.onTogglePause}
            onBackToLobby={lifecycleIntents.onBackToLobby}
            onRestart={lifecycleIntents.onRestart}
            presentation="icon"
            visibleKinds={utilityKinds}
            buttonClassName="border-white/15 bg-white/5 text-white hover:bg-white/10"
          />
        ) : null
      }
      className="border-white/10 bg-black/20 px-3 py-3 text-xs uppercase"
    />
  );
};
