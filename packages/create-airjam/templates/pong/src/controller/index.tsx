import {
  useAudio,
  useAirJamController,
  useControllerToasts,
  useControllerTick,
  useInputWriter,
  useRemoteSound,
} from "@air-jam/sdk";
import type { PlayerProfile } from "@air-jam/sdk/protocol";
import { ForcedOrientationShell } from "@air-jam/sdk/ui";
import { useEffect, useMemo, useRef } from "react";
import { ControllerHeader } from "./components/controller-header";
import { EndedPanel } from "./components/ended-panel";
import { LobbyPanel } from "./components/lobby-panel";
import { PlayingControls } from "./components/playing-controls";
import { useControllerConnectionNotice } from "./hooks/use-controller-connection-notice";
import { usePongStore, type PongState } from "../game/stores";
import {
  getLobbyReadinessText,
  getMatchReadiness,
} from "../game/domain/match-readiness";
import { getTeamCounts } from "../game/domain/team-slots";
import { PONG_SOUND_MANIFEST } from "../game/shared/sounds";

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
  const botCounts = usePongStore((state: PongState) => state.botCounts);
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
  const team1Players = useMemo(
    () =>
      controller.players
        .filter((player) => teamAssignments[player.id]?.team === "team1")
        .sort((left, right) => {
          const leftPosition = teamAssignments[left.id]?.position === "front" ? 0 : 1;
          const rightPosition = teamAssignments[right.id]?.position === "front" ? 0 : 1;
          return leftPosition - rightPosition;
        }),
    [controller.players, teamAssignments],
  );
  const team2Players = useMemo(
    () =>
      controller.players
        .filter((player) => teamAssignments[player.id]?.team === "team2")
        .sort((left, right) => {
          const leftPosition = teamAssignments[left.id]?.position === "front" ? 0 : 1;
          const rightPosition = teamAssignments[right.id]?.position === "front" ? 0 : 1;
          return leftPosition - rightPosition;
        }),
    [controller.players, teamAssignments],
  );
  const readiness = useMemo(
    () => getMatchReadiness(teamCounts, botCounts),
    [teamCounts, botCounts],
  );
  const readinessText = useMemo(
    () =>
      getLobbyReadinessText(
        teamCounts,
        botCounts,
        pointsToWin,
        "controller",
      ),
    [teamCounts, botCounts, pointsToWin],
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

  useEffect(() => {
    const releaseDirection = () => {
      directionRef.current = 0;
    };

    window.addEventListener("blur", releaseDirection);
    document.addEventListener("visibilitychange", releaseDirection);

    return () => {
      window.removeEventListener("blur", releaseDirection);
      document.removeEventListener("visibilitychange", releaseDirection);
    };
  }, []);

  return (
    <ForcedOrientationShell desired="portrait" className="bg-zinc-950">
      <div className="pong-controller-shell pong-safe-screen flex h-full w-full min-h-0 flex-col text-white">
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
          <div className="rounded-b-[18px] border-b border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100">
            {connectionNotice}
          </div>
        ) : null}
        {latestToast ? (
          <div
            className="rounded-b-[18px] border-b px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
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
            teamCounts={teamCounts}
            botCounts={botCounts}
            team1Players={team1Players}
            team2Players={team2Players}
            pointsToWin={pointsToWin}
            canStartMatch={readiness.canStart}
            controlsDisabled={controlsDisabled}
            readinessText={readinessText}
            onJoinTeam={(team) => actions.joinTeam({ team })}
            onSetBotCount={(team, count) => actions.setBotCount({ team, count })}
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
            myTeam={myTeam}
            onDirectionChange={(direction) => {
              directionRef.current = direction;
            }}
          />
        )}
      </div>
    </ForcedOrientationShell>
  );
}
