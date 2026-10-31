/**
 * Controller surface for air-capture.
 *
 * Flow:
 *  1. The binding supplies the controller audio runtime.
 *  2. Phase-specific panels (`ControllerLobbyPanel`,
 *     `ControllerPlayingControls`, `ControllerEndedPanel`) are picked from
 *     the networked `matchPhase`.
 *  3. The SDK's stick and buttons fill the declared controls and send them;
 *     the host's simulation reads them each step.
 *
 * No gameplay logic lives here — everything authoritative is in the host
 * stores under `../game/stores/` and is replicated down.
 */
import {
  useAirJamController,
  useAirJamStore,
  type PlayerProfile,
} from "@air-jam/sdk";
import { ControllerPlayerNameField, SurfaceViewport } from "@air-jam/sdk/ui";
import type { JSX } from "react";
import { memo, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  getLobbyReadinessText,
  getMatchReadiness,
  getTeamCounts,
} from "../game/domain/match-readiness";
import { prototypeMatchStore } from "../game/stores/match/match-store";
import {
  ControllerHeader,
  type ControllerConnectionStatus,
  type ControllerMatchPhase,
} from "./components/controller-header";
import {
  ControllerEndedPanel,
  ControllerLobbyPanel,
  ControllerPlayingControls,
} from "./components/controller-phase-panels";

const ControllerHeaderRuntime = memo(function ControllerHeaderRuntime({
  myProfile,
  roomId,
  connectionStatus,
  matchPhase,
  runtimeState,
  canSendSystemCommand,
  canStartMatch,
  onReturnToLobby,
  onStartMatch,
  onRestartMatch,
}: {
  myProfile: PlayerProfile | null;
  roomId: string | null;
  connectionStatus: ControllerConnectionStatus;
  matchPhase: ControllerMatchPhase;
  runtimeState?: "playing" | "paused";
  canSendSystemCommand: boolean;
  canStartMatch: boolean;
  onReturnToLobby: () => void;
  onStartMatch: () => void;
  onRestartMatch: () => void;
}) {
  const controller = useAirJamController();

  return (
    <ControllerHeader
      myProfile={myProfile}
      roomId={roomId}
      connectionStatus={connectionStatus}
      matchPhase={matchPhase}
      runtimeState={runtimeState}
      canSendSystemCommand={canSendSystemCommand}
      canStartMatch={canStartMatch}
      onTogglePause={() =>
        controller.sendSystemCommand(
          runtimeState === "playing" ? "pause" : "resume",
        )
      }
      onStartMatch={onStartMatch}
      onRestartMatch={onRestartMatch}
      onReturnToLobby={onReturnToLobby}
    />
  );
});

const ControllerScreen = () => {
  const controllerState = useAirJamController(
    useShallow((state) => ({
      roomId: state.roomId,
      controllerId: state.controllerId,
      connectionStatus: state.connectionStatus,
      runtimeState: state.runtimeState,
      players: state.players,
    })),
  );

  const matchPhase = useAirJamStore(
    prototypeMatchStore,
    (state) => state.matchPhase,
  );
  const pointsToWin = useAirJamStore(
    prototypeMatchStore,
    (state) => state.pointsToWin,
  );
  const botCounts = useAirJamStore(
    prototypeMatchStore,
    (state) => state.botCounts,
  );
  const teamAssignments = useAirJamStore(
    prototypeMatchStore,
    (state) => state.teamAssignments,
  );
  const matchSummary = useAirJamStore(
    prototypeMatchStore,
    (state) => state.matchSummary,
  );
  const countdownRemainingSeconds = useAirJamStore(
    prototypeMatchStore,
    (state) => state.countdownSeconds ?? 0,
  );
  const actions = prototypeMatchStore.actions;

  const controlsDisabled = controllerState.connectionStatus !== "connected";
  const canSendSystemCommand = controllerState.connectionStatus === "connected";

  const myAssignment = controllerState.controllerId
    ? teamAssignments[controllerState.controllerId]
    : undefined;
  const myTeam = myAssignment?.teamId ?? null;

  const myProfile = useAirJamController((state) =>
    state.controllerId
      ? (state.players.find((player) => player.id === state.controllerId) ??
        null)
      : null,
  );

  const connectedAssignments = useMemo(() => {
    const connectedPlayerIdSet = new Set(
      controllerState.players.map((player) => player.id),
    );

    return Object.entries(teamAssignments)
      .filter(([controllerId]) => connectedPlayerIdSet.has(controllerId))
      .map(([, assignment]) => assignment);
  }, [controllerState.players, teamAssignments]);

  const teamPlayers = useMemo(
    () => ({
      solaris: controllerState.players.filter(
        (player) => teamAssignments[player.id]?.teamId === "solaris",
      ),
      nebulon: controllerState.players.filter(
        (player) => teamAssignments[player.id]?.teamId === "nebulon",
      ),
    }),
    [controllerState.players, teamAssignments],
  );

  const teamCounts = useMemo(
    () => getTeamCounts(connectedAssignments),
    [connectedAssignments],
  );
  const readiness = useMemo(
    () => getMatchReadiness(teamCounts, botCounts),
    [botCounts, teamCounts],
  );
  const readinessText = useMemo(
    () => getLobbyReadinessText(teamCounts, botCounts, pointsToWin),
    [botCounts, pointsToWin, teamCounts],
  );

  const desiredOrientation =
    matchPhase === "countdown" || matchPhase === "playing"
      ? "landscape"
      : "portrait";

  return (
    <SurfaceViewport orientation={desiredOrientation}>
      <div className="flex h-full w-full flex-col overflow-hidden bg-zinc-950 text-white">
        <ControllerHeaderRuntime
          myProfile={myProfile}
          roomId={controllerState.roomId}
          connectionStatus={controllerState.connectionStatus}
          matchPhase={matchPhase}
          runtimeState={controllerState.runtimeState}
          canSendSystemCommand={canSendSystemCommand}
          canStartMatch={readiness.canStart}
          onReturnToLobby={() => actions.returnToLobby()}
          onStartMatch={() => actions.startMatch()}
          onRestartMatch={() => actions.restartMatch()}
        />

        {matchPhase === "lobby" ? (
          <ControllerPlayerNameField
            className="border-b border-white/10 bg-black/30 px-3 py-2"
            labelClassName="text-[0.625rem] font-semibold tracking-[0.2em] text-zinc-400 uppercase"
            inputClassName="w-full rounded-xl border border-white/15 bg-zinc-900/85 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-sky-400/45 focus:ring-1 focus:ring-sky-400/25"
          />
        ) : null}

        {matchPhase === "lobby" ? (
          <ControllerLobbyPanel
            myTeam={myTeam}
            controlsDisabled={controlsDisabled}
            teamCounts={teamCounts}
            botCounts={botCounts}
            pointsToWin={pointsToWin}
            readinessText={readinessText}
            canStartMatch={readiness.canStart}
            onStartMatch={() => actions.startMatch()}
            teamPlayers={teamPlayers}
            onSelectTeam={(teamId) => actions.joinTeam({ teamId })}
            onSetTeamBotCount={(teamId, count) =>
              actions.setTeamBotCount({ teamId, count })
            }
            onSetPointsToWin={(nextPointsToWin) =>
              actions.setPointsToWin({ pointsToWin: nextPointsToWin })
            }
          />
        ) : matchPhase === "ended" ? (
          <ControllerEndedPanel
            matchSummary={matchSummary}
            runtimeState={controllerState.runtimeState}
            onBackToLobby={() => actions.returnToLobby()}
            onRestart={() => actions.restartMatch()}
          />
        ) : (
          <ControllerPlayingControls
            countdownRemainingSeconds={countdownRemainingSeconds}
          />
        )}
      </div>
    </SurfaceViewport>
  );
};

export const ControllerView = (): JSX.Element => {
  return <ControllerScreen />;
};
