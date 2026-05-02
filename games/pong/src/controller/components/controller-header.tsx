import { useAirJamController } from "@air-jam/sdk";
import {
  LifecycleActionGroup,
  PlayerAvatar,
  RuntimeShellHeader,
  useControllerLifecycleIntents,
  useControllerLifecyclePermissions,
  useControllerShellStatus,
  type LifecycleActionKind,
} from "@air-jam/sdk/ui";
import { usePongStore } from "../../game/stores";
import { useControllerConnectionNotice } from "../hooks/use-controller-connection-notice";
import { usePongControllerTeams } from "../hooks/use-pong-controller-teams";

export const ControllerHeader = () => {
  const controller = useAirJamController();
  const roomId = useAirJamController((state) => state.roomId);
  const connectionStatus = useAirJamController(
    (state) => state.connectionStatus,
  );
  const runtimeState = useAirJamController((state) => state.runtimeState);
  const selfPlayer = useAirJamController((state) => state.selfPlayer);
  const actions = usePongStore.useActions();
  const matchPhase = usePongStore((state) => state.matchPhase);
  const { readiness } = usePongControllerTeams();
  const { canSendSystemCommand } = useControllerConnectionNotice();
  const shellStatus = useControllerShellStatus({
    roomId,
    connectionStatus,
    playerLabel: selfPlayer?.label ?? null,
  });
  const lifecyclePermissions = useControllerLifecyclePermissions({
    phase: matchPhase,
    canStartMatch: readiness.canStart,
    canSendSystemCommand,
  });
  const lifecycleIntents = useControllerLifecycleIntents({
    onStart: () => actions.startMatch(),
    onTogglePause: () =>
      controller.sendSystemCommand(
        runtimeState === "playing" ? "pause" : "resume",
      ),
    onBackToLobby: () => actions.returnToLobby(),
    onRestart: () => actions.restartMatch(),
  });
  const utilityKinds: LifecycleActionKind[] =
    matchPhase === "playing"
      ? ["pause-toggle", "back-to-lobby"]
      : matchPhase === "ended"
        ? ["restart", "back-to-lobby"]
        : [];

  return (
    <RuntimeShellHeader
      connectionStatus={connectionStatus}
      leftSlot={
        <div className="flex min-w-0 items-center gap-3">
          {selfPlayer ? (
            <PlayerAvatar
              player={selfPlayer}
              size="sm"
              className="h-11 w-11 border-2 ring-2 ring-white/12"
            />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-zinc-800/90 text-[0.6875rem] font-bold text-zinc-300">
              {shellStatus.identityInitial}
            </span>
          )}
          <div className="min-w-0 space-y-0.5">
            {shellStatus.hasIdentity ? (
              <div className="truncate text-sm leading-tight font-semibold text-zinc-100 normal-case sm:text-[0.9375rem]">
                {shellStatus.displayName}
              </div>
            ) : null}
            <div className="text-[0.625rem] leading-tight font-semibold tracking-[0.18em] text-zinc-300 tabular-nums sm:text-[0.6875rem]">
              {shellStatus.roomLine}
            </div>
          </div>
        </div>
      }
      rightSlot={
        utilityKinds.length > 0 ? (
          <LifecycleActionGroup
            phase={matchPhase}
            runtimeState={runtimeState}
            canInteract={lifecyclePermissions.canInteractForPhase}
            onStart={lifecycleIntents.onStart}
            onTogglePause={lifecycleIntents.onTogglePause}
            onBackToLobby={lifecycleIntents.onBackToLobby}
            onRestart={lifecycleIntents.onRestart}
            restartLabel="Play Again"
            presentation="icon"
            visibleKinds={utilityKinds}
            buttonClassName="border-white/15 bg-white/5 text-white hover:bg-white/10"
          />
        ) : null
      }
      className="border-white/10 bg-black/35 px-3 py-2 text-xs uppercase sm:px-3.5"
    />
  );
};
