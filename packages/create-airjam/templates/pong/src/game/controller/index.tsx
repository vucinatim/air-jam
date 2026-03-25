import {
  useAudio,
  useAirJamController,
  useControllerToasts,
  useControllerTick,
  useInputWriter,
  useRemoteSound,
} from "@air-jam/sdk";
import { ForcedOrientationShell } from "@air-jam/sdk/ui";
import { useEffect, useMemo, useRef } from "react";
import { ControllerHeader } from "./components/controller-header";
import { EndedPanel } from "./components/ended-panel";
import { LobbyPanel } from "./components/lobby-panel";
import { PlayingControls } from "./components/playing-controls";
import { useControllerConnectionNotice } from "./hooks/use-controller-connection-notice";
import { usePongStore, type PongState } from "../store";
import {
  getLobbyReadinessText,
  getMatchReadiness,
  getTeamCounts,
} from "../shared/match-readiness";
import { PONG_SOUND_MANIFEST } from "../shared/sounds";

export function ControllerView() {
  const controller = useAirJamController();
  const audio = useAudio(PONG_SOUND_MANIFEST);
  const { latestToast } = useControllerToasts();
  const writeInput = useInputWriter();
  const directionRef = useRef(0);

  const teamAssignments = usePongStore(
    (state: PongState) => state.teamAssignments,
  );
  const matchPhase = usePongStore((state: PongState) => state.matchPhase);
  const botTeam = usePongStore((state: PongState) => state.botTeam);
  const pointsToWin = usePongStore((state: PongState) => state.pointsToWin);
  const matchSummary = usePongStore((state: PongState) => state.matchSummary);
  const actions = usePongStore.useActions();

  const myAssignment = controller.controllerId
    ? teamAssignments[controller.controllerId]
    : undefined;
  const myTeam = myAssignment?.team ?? null;
  const myProfile = controller.selfPlayer;

  const connectedPlayerIdSet = useMemo(
    () => new Set(controller.players.map((player) => player.id)),
    [controller.players],
  );
  const connectedAssignments = useMemo(
    () =>
      Object.entries(teamAssignments)
        .filter(([playerId]) => connectedPlayerIdSet.has(playerId))
        .map(([, assignment]) => assignment),
    [connectedPlayerIdSet, teamAssignments],
  );
  const teamCounts = useMemo(
    () => getTeamCounts(connectedAssignments),
    [connectedAssignments],
  );
  const readiness = useMemo(
    () => getMatchReadiness(teamCounts, botTeam),
    [teamCounts, botTeam],
  );
  const readinessText = useMemo(
    () =>
      getLobbyReadinessText(
        teamCounts,
        botTeam,
        pointsToWin,
        "controller",
      ),
    [teamCounts, botTeam, pointsToWin],
  );

  const {
    canSendSystemCommand,
    controlsDisabled,
    connectionNotice,
  } = useControllerConnectionNotice(controller.connectionStatus);

  useRemoteSound(PONG_SOUND_MANIFEST, audio, {
    enabled: controller.connectionStatus === "connected",
  });

  useControllerTick(
    () => {
      writeInput({
        direction: directionRef.current,
      });
    },
    {
      enabled:
        controller.connectionStatus === "connected" &&
        controller.gameState === "playing",
      intervalMs: 16,
    },
  );

  useEffect(() => {
    if (controlsDisabled) {
      directionRef.current = 0;
    }
  }, [controlsDisabled]);

  return (
    <ForcedOrientationShell desired="portrait" className="bg-zinc-950">
      <div className="flex h-full w-full flex-col overflow-hidden bg-zinc-950 text-white">
        <ControllerHeader
          roomId={controller.roomId}
          myProfile={myProfile}
          connectionStatus={controller.connectionStatus}
          matchPhase={matchPhase}
          gameState={controller.gameState}
          canSendSystemCommand={canSendSystemCommand}
          onTogglePause={() => controller.sendSystemCommand("toggle_pause")}
          onReturnToLobby={() => actions.returnToLobby()}
        />

        {connectionNotice ? (
          <div className="border-b border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200">
            {connectionNotice}
          </div>
        ) : null}
        {latestToast ? (
          <div
            className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{
              borderColor: `${latestToast.color ?? "#38bdf8"}55`,
              backgroundColor: `${latestToast.color ?? "#38bdf8"}1a`,
              color: latestToast.color ?? "#bae6fd",
            }}
          >
            {latestToast.message}
          </div>
        ) : null}

        {matchPhase === "lobby" ? (
          <LobbyPanel
            myTeam={myTeam}
            botTeam={botTeam}
            pointsToWin={pointsToWin}
            canStartMatch={readiness.canStart}
            controlsDisabled={controlsDisabled}
            readinessText={readinessText}
            onJoinTeam={(team) => actions.joinTeam({ team })}
            onToggleBotEnabled={(enabled) => actions.setBotEnabled({ enabled })}
            onSetPointsToWin={(nextPointsToWin) =>
              actions.setPointsToWin({ pointsToWin: nextPointsToWin })
            }
            onStartMatch={() => actions.startMatch()}
          />
        ) : matchPhase === "ended" ? (
          <EndedPanel
            matchSummary={matchSummary}
            canSendSystemCommand={canSendSystemCommand}
            onRestartMatch={() => actions.restartMatch()}
            onReturnToLobby={() => actions.returnToLobby()}
          />
        ) : (
          <PlayingControls
            controlsDisabled={controlsDisabled}
            onDirectionChange={(direction) => {
              directionRef.current = direction;
            }}
          />
        )}
      </div>
    </ForcedOrientationShell>
  );
}
