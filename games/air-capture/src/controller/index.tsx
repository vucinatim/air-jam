import {
  useAirJamController,
  useAirJamControllerState,
  useControllerTick,
  useInputWriter,
  type PlayerProfile,
} from "@air-jam/sdk";
import {
  ControllerPlayerNameField,
  SurfaceViewport,
} from "@air-jam/sdk/ui";
import type { JSX } from "react";
import { memo, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { createControllerStore } from "../game/controller-store";
import { useMatchCountdown } from "../game/hooks/use-match-countdown";
import {
  getLobbyReadinessText,
  getMatchReadiness,
  getTeamCounts,
} from "../game/domain/match-readiness";
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
      onTogglePause={() => controller.sendSystemCommand("toggle_pause")}
      onStartMatch={onStartMatch}
      onRestartMatch={onRestartMatch}
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
      runtimeState: state.runtimeState,
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
        controllerState.runtimeState === "playing",
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

  const desiredOrientation =
    matchPhase === "countdown" || matchPhase === "playing"
      ? "landscape"
      : "portrait";

  return (
    <SurfaceViewport
      orientation={desiredOrientation}
      preset="controller-phone"
    >
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

        <ControllerPlayerNameField
          className="border-b border-white/10 bg-black/30 px-3 py-2"
          labelClassName="text-[0.625rem] font-semibold tracking-[0.2em] text-zinc-400 uppercase"
          inputClassName="w-full rounded-xl border border-white/15 bg-zinc-900/85 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-sky-400/45 focus:ring-1 focus:ring-sky-400/25"
        />

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
          />
        ) : (
          <ControllerPlayingControls
            store={store}
            countdownRemainingSeconds={countdownRemainingSeconds}
          />
        )}
      </div>
    </SurfaceViewport>
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
