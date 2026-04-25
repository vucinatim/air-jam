import { useAirJamController } from "@air-jam/sdk";
import {
  LifecycleActionGroup,
  useControllerLifecycleIntents,
  useControllerLifecyclePermissions,
} from "@air-jam/sdk/ui";
import { useGameStore } from "../../game/stores";

export const EndedPanel = () => {
  const connectionStatus = useAirJamController(
    (state) => state.connectionStatus,
  );
  const runtimeState = useAirJamController((state) => state.runtimeState);
  const matchPhase = useGameStore((state) => state.matchPhase);
  const matchSummary = useGameStore((state) => state.matchSummary);
  const scores = useGameStore((state) => state.scores);
  const actions = useGameStore.useActions();
  const lifecyclePermissions = useControllerLifecyclePermissions({
    phase: matchPhase,
    canStartMatch: false,
    canSendSystemCommand: connectionStatus === "connected",
  });
  const lifecycleIntents = useControllerLifecycleIntents({
    onBackToLobby: () => actions.resetToLobby(),
    onRestart: () => actions.resetToLobby(),
  });

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.2),transparent_42%),linear-gradient(180deg,#f5f5f4_0%,#e7e5e4_100%)] p-3 sm:p-4">
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 rounded-none border-4 border-zinc-700 bg-zinc-950/92 px-5 py-6 text-zinc-100 shadow-[0_24px_60px_rgba(24,24,27,0.35)]">
        <div className="text-center">
          <p className="text-[11px] tracking-[0.2em] text-zinc-500 uppercase">
            Match Ended
          </p>
          <p className="mt-3 text-2xl leading-tight text-white sm:text-3xl">
            {matchSummary?.winner === "draw"
              ? "Draw"
              : matchSummary?.winner === "team1"
                ? "Coder Wins"
                : "Reviewer Wins"}
          </p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-y-4 border-zinc-800 py-4">
          <div className="min-w-0 bg-red-600 px-3 py-3 text-center text-white">
            <p className="text-[10px] tracking-[0.16em] text-red-100 uppercase">
              Coder
            </p>
            <p className="mt-1 text-3xl leading-none">
              {matchSummary?.scores.team1 ?? scores.team1}
            </p>
          </div>
          <p className="text-2xl text-zinc-500">:</p>
          <div className="min-w-0 bg-blue-600 px-3 py-3 text-center text-white">
            <p className="text-[10px] tracking-[0.16em] text-blue-100 uppercase">
              Reviewer
            </p>
            <p className="mt-1 text-3xl leading-none">
              {matchSummary?.scores.team2 ?? scores.team2}
            </p>
          </div>
        </div>

        <LifecycleActionGroup
          phase={matchPhase}
          runtimeState={runtimeState}
          canInteract={lifecyclePermissions.canInteractForPhase}
          onBackToLobby={lifecycleIntents.onBackToLobby}
          onRestart={lifecycleIntents.onRestart}
          presentation="pill"
          visibleKinds={["back-to-lobby", "restart"]}
          className="w-full flex-col items-stretch gap-2"
          buttonClassName="h-11 w-full justify-center rounded-none border-4 border-zinc-700 bg-zinc-900 px-4 text-[0.6875rem] font-semibold tracking-[0.18em] text-white hover:bg-zinc-800"
        />
      </div>
    </div>
  );
};
