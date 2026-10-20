import {
  type PlayerProfile,
  useAirJamHost,
  useAirJamStore,
} from "@air-jam/sdk";
import { useHostJoinControls } from "@air-jam/sdk/ui";
import { useMemo, useState } from "react";
import { type TeamId } from "../../game/domain/team";
import { useMatchCountdown } from "../../game/hooks/use-match-countdown";
import { prototypeMatchStore } from "../../game/stores/match/match-store";

/** What the host screen shows; the match itself runs in the simulation. */
export function useAirCaptureHostRuntime() {
  const host = useAirJamHost();
  const players = useAirJamHost((state) => state.players);
  const roomId = useAirJamHost((state) => state.roomId);
  const connectionStatus = useAirJamHost((state) => state.connectionStatus);
  const runtimeState = useAirJamHost((state) => state.runtimeState);
  const lastError = useAirJamHost((state) => state.lastError);

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
  const countdownEndsAtMs = useAirJamStore(
    prototypeMatchStore,
    (state) => state.countdownEndsAtMs,
  );
  const matchActions = prototypeMatchStore.actions;
  const countdownRemainingSeconds = useMatchCountdown(countdownEndsAtMs);
  const teamPlayers = useMemo(() => {
    const grouped: Record<TeamId, PlayerProfile[]> = {
      solaris: [],
      nebulon: [],
    };

    players.forEach((player) => {
      const teamId = teamAssignments[player.id]?.teamId;
      if (!teamId) {
        return;
      }

      grouped[teamId].push(player);
    });

    return grouped;
  }, [players, teamAssignments]);

  const joinControls = useHostJoinControls({
    joinUrl: host.joinUrl,
    onStartMatch: () => matchActions.startMatch(),
  });

  const showPausedOverlay =
    (matchPhase === "countdown" || matchPhase === "playing") &&
    runtimeState !== "playing";
  const sceneMode: "match" | "spectator" =
    matchPhase === "countdown" || matchPhase === "playing"
      ? "match"
      : "spectator";
  const showBackdrop = matchPhase === "lobby" || matchPhase === "ended";
  const activeScenePhase =
    matchPhase === "countdown" || matchPhase === "playing";
  const [sceneHasMounted, setSceneHasMounted] = useState(activeScenePhase);
  // Latches during render: once the scene has been active it stays mounted.
  if (activeScenePhase && !sceneHasMounted) setSceneHasMounted(true);

  return {
    host,
    players,
    roomId,
    connectionStatus,
    runtimeState,
    lastError,
    matchPhase,
    pointsToWin,
    botCounts,
    matchSummary,
    matchActions,
    countdownRemainingSeconds,
    teamPlayers,
    joinControls,
    showPausedOverlay,
    sceneMode,
    showBackdrop,
    shouldRenderGameplayStage: activeScenePhase || sceneHasMounted,
  };
}
