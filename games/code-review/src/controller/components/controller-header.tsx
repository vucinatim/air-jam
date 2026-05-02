import { useAirJamController } from "@air-jam/sdk";
import {
  LifecycleActionGroup,
  PlayerAvatar,
  RuntimeShellHeader,
  useControllerLifecycleIntents,
  useControllerLifecyclePermissions,
  useControllerShellStatus,
} from "@air-jam/sdk/ui";
import { useGameStore } from "../../game/stores";
import { useCodeReviewControllerTeams } from "../hooks/use-code-review-controller-teams";

export const ControllerHeader = () => {
  const controller = useAirJamController();
  const roomId = useAirJamController((state) => state.roomId);
  const connectionStatus = useAirJamController(
    (state) => state.connectionStatus,
  );
  const runtimeState = useAirJamController((state) => state.runtimeState);
  const matchPhase = useGameStore((state) => state.matchPhase);
  const actions = useGameStore.useActions();
  const teams = useCodeReviewControllerTeams();
  const shellStatus = useControllerShellStatus({
    roomId,
    connectionStatus,
    playerLabel: teams.myProfile?.label ?? null,
  });
  const lifecyclePermissions = useControllerLifecyclePermissions({
    phase: matchPhase,
    canStartMatch: connectionStatus === "connected" && teams.readiness.canStart,
    canSendSystemCommand: connectionStatus === "connected",
  });
  const lifecycleIntents = useControllerLifecycleIntents({
    onTogglePause: () =>
      controller.sendSystemCommand(
        runtimeState === "playing" ? "pause" : "resume",
      ),
    onBackToLobby: () => actions.resetToLobby(),
    onRestart: () => actions.resetToLobby(),
  });

  return (
    <RuntimeShellHeader
      connectionStatus={connectionStatus}
      leftSlot={
        <div className="flex min-w-0 items-center gap-3">
          {teams.myProfile ? (
            <PlayerAvatar
              player={teams.myProfile}
              size="sm"
              className="h-10 w-10 border-2"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-zinc-800 text-[0.6875rem] font-semibold text-zinc-200">
              {shellStatus.identityInitial}
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-100">
              {shellStatus.displayName}
            </div>
            <div className="text-[0.625rem] font-semibold tracking-[0.18em] text-zinc-400 uppercase sm:text-[0.6875rem]">
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
            onTogglePause={lifecycleIntents.onTogglePause}
            onBackToLobby={lifecycleIntents.onBackToLobby}
            onRestart={lifecycleIntents.onRestart}
            presentation="icon"
            visibleKinds={
              matchPhase === "playing"
                ? ["pause-toggle", "back-to-lobby"]
                : ["restart", "back-to-lobby"]
            }
            buttonClassName="border-white/12 bg-white/6 text-white hover:bg-white/12"
          />
        )
      }
      className="border-zinc-700 bg-zinc-950/95"
    />
  );
};
