import {
  useAirJamController,
  useAudio,
  useControllerTick,
  useInputWriter,
  useRemoteSound,
} from "@air-jam/sdk";
import { ForcedOrientationShell } from "@air-jam/sdk/ui";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { createControllerStore } from "../game/controller-store";
import {
  getLobbyReadinessText,
  getMatchReadiness,
  getTeamCounts,
  type TeamCounts,
} from "../game/domain/match-readiness";
import { usePrototypeMatchStore } from "../game/stores/match/match-store";
import { SOUND_MANIFEST } from "../game/audio/sounds";
import { ControllerHeader } from "./components/controller-header";
import {
  ControllerEndedPanel,
  ControllerLobbyPanel,
  ControllerPlayingControls,
} from "./components/controller-phase-panels";

const ControllerContent = () => {
  const controller = useAirJamController();
  const audio = useAudio(SOUND_MANIFEST);
  const writeInput = useInputWriter();
  const [store] = useState(() => createControllerStore());

  const matchPhase = usePrototypeMatchStore((state) => state.matchPhase);
  const pointsToWin = usePrototypeMatchStore((state) => state.pointsToWin);
  const botCounts = usePrototypeMatchStore((state) => state.botCounts);
  const teamAssignments = usePrototypeMatchStore((state) => state.teamAssignments);
  const matchSummary = usePrototypeMatchStore((state) => state.matchSummary);
  const actions = usePrototypeMatchStore.useActions();

  useRemoteSound(SOUND_MANIFEST, audio, {
    enabled: controller.connectionStatus === "connected",
  });

  const controlsDisabled = controller.connectionStatus !== "connected";
  const canSendSystemCommand = controller.connectionStatus === "connected";

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
        controller.connectionStatus === "connected" &&
        matchPhase === "playing" &&
        controller.gameState === "playing",
      intervalMs: 16,
    },
  );

  const myAssignment = controller.controllerId
    ? teamAssignments[controller.controllerId]
    : undefined;
  const myTeam = myAssignment?.teamId ?? null;

  const myProfile = controller.selfPlayer;

  const connectedAssignments = useMemo(() => {
    const connectedPlayerIdSet = new Set(
      controller.players.map((player) => player.id),
    );

    return Object.entries(teamAssignments)
      .filter(([controllerId]) => connectedPlayerIdSet.has(controllerId))
      .map(([, assignment]) => assignment);
  }, [controller.players, teamAssignments]);

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
    () => ({
      solaris: teamCounts.solaris + botCounts.solaris,
      nebulon: teamCounts.nebulon + botCounts.nebulon,
    }),
    [botCounts, teamCounts],
  );

  const maxBotsByTeam: TeamCounts = useMemo(
    () => ({
      solaris: Math.max(0, 2 - teamCounts.solaris),
      nebulon: Math.max(0, 2 - teamCounts.nebulon),
    }),
    [teamCounts],
  );

  const desiredOrientation = matchPhase === "playing" ? "landscape" : "portrait";

  return (
    <ForcedOrientationShell desired={desiredOrientation}>
      <div className="flex h-full w-full flex-col overflow-hidden bg-zinc-950 text-white">
        <ControllerHeader
          myProfile={myProfile}
          roomId={controller.roomId}
          connectionStatus={controller.connectionStatus}
          matchPhase={matchPhase}
          gameState={controller.gameState}
          canSendSystemCommand={canSendSystemCommand}
          controlsDisabled={controlsDisabled}
          onTogglePause={() => controller.sendSystemCommand("toggle_pause")}
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
          <ControllerPlayingControls store={store} />
        )}
      </div>
    </ForcedOrientationShell>
  );
};

export const ControllerView = (): JSX.Element => {
  return <ControllerContent />;
};
