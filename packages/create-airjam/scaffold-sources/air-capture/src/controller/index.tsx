import {
  useAirJamController,
  useAirJamControllerState,
  useControllerTick,
  useInputWriter,
  type PlayerProfile,
} from "@air-jam/sdk";
import { ForcedOrientationShell } from "@air-jam/sdk/ui";
import type { JSX } from "react";
import { memo, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { createControllerStore } from "../game/controller-store";
import { useMatchCountdown } from "../game/hooks/use-match-countdown";
import {
  getLobbyReadinessText,
  getMatchReadiness,
  getTeamCounts,
  type TeamCounts,
} from "../game/domain/match-readiness";
import {
  getEffectiveTeamCounts,
  getMaxBotsForTeam,
} from "../game/domain/team-slots";
import { usePrototypeMatchStore } from "../game/stores/match/match-store";
import {
  ControllerAudioProvider,
} from "../game/audio/controller-audio";
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
  gameState,
  canSendSystemCommand,
  controlsDisabled,
  onReturnToLobby,
}: {
  myProfile: PlayerProfile | null;
  roomId: string | null;
  connectionStatus: ControllerConnectionStatus;
  matchPhase: ControllerMatchPhase;
  gameState: "lobby" | "playing" | "paused" | "ended";
  canSendSystemCommand: boolean;
  controlsDisabled: boolean;
  onReturnToLobby: () => void;
}) {
  const controller = useAirJamController();

  return (
    <ControllerHeader
      myProfile={myProfile}
      roomId={roomId}
      connectionStatus={connectionStatus}
      matchPhase={matchPhase}
      gameState={gameState}
      canSendSystemCommand={canSendSystemCommand}
      controlsDisabled={controlsDisabled}
      onTogglePause={() => controller.sendSystemCommand("toggle_pause")}
      onReturnToLobby={onReturnToLobby}
    />
  );
});

const ControllerScreen = () => {
  const writeInput = useInputWriter();
  const [store] = useState(() => createControllerStore());
  const controllerState = useAirJamControllerState(
    useShallow((state) => ({
      roomId: state.roomId,
      controllerId: state.controllerId,
      connectionStatus: state.connectionStatus,
      gameState: state.gameState,
      players: state.players,
    })),
  );

  const matchPhase = usePrototypeMatchStore((state) => state.matchPhase);
  const pointsToWin = usePrototypeMatchStore((state) => state.pointsToWin);
  const botCounts = usePrototypeMatchStore((state) => state.botCounts);
  const teamAssignments = usePrototypeMatchStore((state) => state.teamAssignments);
  const matchSummary = usePrototypeMatchStore((state) => state.matchSummary);
  const countdownEndsAtMs = usePrototypeMatchStore(
    (state) => state.countdownEndsAtMs,
  );
  const actions = usePrototypeMatchStore.useActions();
  const countdownRemainingSeconds = useMatchCountdown(countdownEndsAtMs);

  const controlsDisabled = controllerState.connectionStatus !== "connected";
  const canSendSystemCommand = controllerState.connectionStatus === "connected";

  useControllerTick(
    () => {
      const state = store.getState();
      writeInput({
        vector: state.vector,
        action: state.action,
        ability: state.ability,
        timestamp: Date.now(),
      });
    },
    {
      enabled:
        controllerState.connectionStatus === "connected" &&
        (matchPhase === "countdown" || matchPhase === "playing") &&
        controllerState.gameState === "playing",
      intervalMs: 16,
    },
  );

  const myAssignment = controllerState.controllerId
    ? teamAssignments[controllerState.controllerId]
    : undefined;
  const myTeam = myAssignment?.teamId ?? null;

  const myProfile = useAirJamControllerState((state) =>
    state.controllerId
      ? state.players.find((player) => player.id === state.controllerId) ?? null
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
    () =>
      getLobbyReadinessText(
        teamCounts,
        botCounts,
        pointsToWin,
      ),
    [botCounts, pointsToWin, teamCounts],
  );

  const effectiveCounts: TeamCounts = useMemo(
    () => getEffectiveTeamCounts(teamCounts, botCounts),
    [botCounts, teamCounts],
  );

  const maxBotsByTeam: TeamCounts = useMemo(
    () => ({
      solaris: getMaxBotsForTeam(teamCounts.solaris),
      nebulon: getMaxBotsForTeam(teamCounts.nebulon),
    }),
    [teamCounts],
  );

  const desiredOrientation =
    matchPhase === "countdown" || matchPhase === "playing"
      ? "landscape"
      : "portrait";

  return (
    <ForcedOrientationShell desired={desiredOrientation}>
      <div className="flex h-full w-full flex-col overflow-hidden bg-zinc-950 text-white">
        <ControllerHeaderRuntime
          myProfile={myProfile}
          roomId={controllerState.roomId}
          connectionStatus={controllerState.connectionStatus}
          matchPhase={matchPhase}
          gameState={controllerState.gameState}
          canSendSystemCommand={canSendSystemCommand}
          controlsDisabled={controlsDisabled}
          onReturnToLobby={() => actions.returnToLobby()}
        />

        {matchPhase === "lobby" ? (
          <ControllerLobbyPanel
            myTeam={myTeam}
            controlsDisabled={controlsDisabled}
            effectiveCounts={effectiveCounts}
            botCounts={botCounts}
            maxBotsByTeam={maxBotsByTeam}
            pointsToWin={pointsToWin}
            readinessText={readinessText}
            canStart={readiness.canStart}
            teamPlayers={teamPlayers}
            onSelectTeam={(teamId) => actions.joinTeam({ teamId })}
            onSetTeamBotCount={(teamId, count) =>
              actions.setTeamBotCount({ teamId, count })
            }
            onSetPointsToWin={(nextPointsToWin) =>
              actions.setPointsToWin({ pointsToWin: nextPointsToWin })
            }
            onStartMatch={() => actions.startMatch()}
          />
        ) : matchPhase === "ended" ? (
          <ControllerEndedPanel
            matchSummary={matchSummary}
            controlsDisabled={controlsDisabled}
            onRestartMatch={() => actions.restartMatch()}
            onReturnToLobby={() => actions.returnToLobby()}
          />
        ) : (
          <ControllerPlayingControls
            store={store}
            countdownRemainingSeconds={countdownRemainingSeconds}
          />
        )}
      </div>
    </ForcedOrientationShell>
  );
};

export const ControllerView = (): JSX.Element => {
  const connectionStatus = useAirJamControllerState(
    (state) => state.connectionStatus,
  );

  return (
    <ControllerAudioProvider
      remoteEnabled={connectionStatus === "connected"}
    >
      <ControllerScreen />
    </ControllerAudioProvider>
  );
};
