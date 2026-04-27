import { useAirJamHost, type PlayerProfile } from "@air-jam/sdk";
import { useHostJoinControls } from "@air-jam/sdk/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBotManager } from "../../game/bot-system/bot-manager";
import { TEAM_IDS, type TeamId } from "../../game/domain/team";
import { useMatchCountdown } from "../../game/hooks/use-match-countdown";
import { useCaptureTheFlagStore } from "../../game/stores/match/capture-the-flag-store";
import { usePrototypeMatchStore } from "../../game/stores/match/match-store";
import { useGameStore } from "../../game/stores/players/game-store";

interface UseAirCaptureHostRuntimeOptions {
  playAudio: (soundId: "player_join" | "success") => void;
}

export function useAirCaptureHostRuntime({
  playAudio,
}: UseAirCaptureHostRuntimeOptions) {
  const host = useAirJamHost();
  const players = useAirJamHost((state) => state.players);
  const roomId = useAirJamHost((state) => state.roomId);
  const connectionStatus = useAirJamHost((state) => state.connectionStatus);
  const runtimeState = useAirJamHost((state) => state.runtimeState);
  const lastError = useAirJamHost((state) => state.lastError);

  const matchPhase = usePrototypeMatchStore((state) => state.matchPhase);
  const pointsToWin = usePrototypeMatchStore((state) => state.pointsToWin);
  const botCounts = usePrototypeMatchStore((state) => state.botCounts);
  const teamAssignments = usePrototypeMatchStore(
    (state) => state.teamAssignments,
  );
  const matchSummary = usePrototypeMatchStore((state) => state.matchSummary);
  const countdownEndsAtMs = usePrototypeMatchStore(
    (state) => state.countdownEndsAtMs,
  );
  const matchActions = usePrototypeMatchStore.useActions();
  const countdownRemainingSeconds = useMatchCountdown(countdownEndsAtMs);
  const ctfScores = useCaptureTheFlagStore((state) => state.scores);
  const resetMatch = useCaptureTheFlagStore((state) => state.resetMatch);

  const gamePlayers = useGameStore((state) => state.players);
  const setPlayerTeam = useGameStore((state) => state.setPlayerTeam);
  const bumpRound = useGameStore((state) => state.bumpRound);
  const previousMatchPhaseRef = useRef(matchPhase);

  const addBot = useBotManager((state) => state.addBot);
  const removeBot = useBotManager((state) => state.removeBot);

  useEffect(() => {
    const previousMatchPhase = previousMatchPhaseRef.current;
    if (previousMatchPhase === matchPhase) {
      return;
    }

    const wasActive =
      previousMatchPhase === "countdown" || previousMatchPhase === "playing";
    const isActive = matchPhase === "countdown" || matchPhase === "playing";

    if (!wasActive && isActive) {
      resetMatch();
      bumpRound();
    } else if (previousMatchPhase === "lobby" && matchPhase === "countdown") {
      resetMatch();
    }

    previousMatchPhaseRef.current = matchPhase;
  }, [bumpRound, matchPhase, resetMatch]);

  useEffect(() => {
    if (matchPhase !== "countdown" || !countdownEndsAtMs) {
      return;
    }

    const remainingMs = countdownEndsAtMs - Date.now();
    if (remainingMs <= 0) {
      matchActions.finishCountdown();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      matchActions.finishCountdown();
    }, remainingMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [countdownEndsAtMs, matchActions, matchPhase]);

  useEffect(() => {
    const store = useGameStore.getState();
    const connectedPlayers = store.players.filter(
      (player) => player.source === "connected",
    );
    const connectedIds = new Set(
      connectedPlayers.map((player) => player.controllerId),
    );
    const hostIds = new Set(players.map((player) => player.id));

    players.forEach((player) => {
      const isNewConnection = !connectedIds.has(player.id);
      store.upsertConnectedPlayer(player, player.id);
      if (isNewConnection) {
        playAudio("player_join");
      }
    });

    connectedPlayers.forEach((player) => {
      if (!hostIds.has(player.controllerId)) {
        store.removeConnectedPlayer(player.controllerId);
      }
    });
  }, [players, playAudio]);

  useEffect(() => {
    if (connectionStatus !== "connected") {
      return;
    }

    matchActions.syncConnectedPlayers({
      connectedPlayerIds: players.map((player) => player.id),
    });
  }, [connectionStatus, matchActions, players]);

  useEffect(() => {
    const currentBotIdsByTeam: Record<TeamId, string[]> = {
      solaris: [],
      nebulon: [],
    };

    gamePlayers.forEach((player) => {
      if (player.source !== "bot") {
        return;
      }
      currentBotIdsByTeam[player.teamId].push(player.controllerId);
    });

    TEAM_IDS.forEach((teamId) => {
      const desiredCount = botCounts[teamId];
      const idsForTeam = currentBotIdsByTeam[teamId];

      while (idsForTeam.length > desiredCount) {
        const botId = idsForTeam.pop();
        if (botId) {
          removeBot(botId);
        }
      }
    });

    TEAM_IDS.forEach((teamId) => {
      const desiredCount = botCounts[teamId];
      const idsForTeam = currentBotIdsByTeam[teamId];

      while (idsForTeam.length < desiredCount) {
        const botId = addBot();
        idsForTeam.push(botId);
        setPlayerTeam(botId, teamId);
      }
    });
  }, [addBot, botCounts, gamePlayers, removeBot, setPlayerTeam]);

  useEffect(() => {
    gamePlayers.forEach((player) => {
      if (player.source !== "connected") {
        return;
      }

      const assignedTeam = teamAssignments[player.controllerId]?.teamId;
      if (assignedTeam) {
        setPlayerTeam(player.controllerId, assignedTeam);
      }
    });
  }, [gamePlayers, setPlayerTeam, teamAssignments]);

  useEffect(() => {
    if (matchPhase !== "playing") {
      return;
    }

    const winner =
      ctfScores.solaris >= pointsToWin
        ? "solaris"
        : ctfScores.nebulon >= pointsToWin
          ? "nebulon"
          : null;

    if (!winner) {
      return;
    }

    matchActions.endMatch({
      winner,
      finalScores: {
        solaris: ctfScores.solaris,
        nebulon: ctfScores.nebulon,
      },
    });
    playAudio("success");
  }, [ctfScores, matchActions, matchPhase, playAudio, pointsToWin]);

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
  const scenePaused =
    (matchPhase !== "countdown" && matchPhase !== "playing") ||
    runtimeState !== "playing";
  const showBackdrop = matchPhase === "lobby" || matchPhase === "ended";
  const activeScenePhase =
    matchPhase === "countdown" || matchPhase === "playing";
  const [sceneHasMounted, setSceneHasMounted] = useState(activeScenePhase);

  useEffect(() => {
    if (activeScenePhase) {
      setSceneHasMounted(true);
    }
  }, [activeScenePhase]);

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
    scenePaused,
    showBackdrop,
    shouldRenderGameplayStage: activeScenePhase || sceneHasMounted,
  };
}
