import {
  useAudioRuntimeControls,
  useAudioRuntimeStatus,
  useAirJamHost,
  useHostRuntimeStateBridge,
  type PlayerProfile,
} from "@air-jam/sdk";
import { HostMuteButton } from "@air-jam/sdk/ui";
import type { Dispatch, JSX, SetStateAction } from "react";
import {
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { useBotManager } from "../game/bot-system/bot-manager";
import { TEAM_IDS, type TeamId } from "../game/domain/team";
import { useMatchCountdown } from "../game/hooks/use-match-countdown";
import {
  useCaptureTheFlagStore,
} from "../game/stores/match/capture-the-flag-store";
import {
  BotsSection,
  CTFDebugSection,
  PlayersSection,
  SceneInfoSection,
} from "../game/debug/debug-sections";
import { useGameStore } from "../game/stores/players/game-store";
import {
  usePrototypeMatchStore,
} from "../game/stores/match/match-store";
import { HostAudioProvider } from "../game/audio/host-audio";
import { useHostAudio } from "../game/audio/use-host-audio";
import {
  AudioBlockedPrompt,
  CountdownOverlay,
  EndedOverlay,
  GameplayFallback,
  type HostConnectionStatus,
  LobbyOverlay,
  PausedOverlay,
  StageBackdrop,
} from "./components/host-overlays";
import { HostLiveChrome } from "./components/host-live-chrome";
import { PlayerHUDOverlay } from "../game/ui/player-hud-overlay";

const GameScene = lazy(async () => {
  const module = await import("../game/engine/game-scene");
  return { default: module.GameScene };
});

const ScoreDisplay = lazy(async () => {
  const module = await import("../game/ui/score-display");
  return { default: module.ScoreDisplay };
});

const DebugOverlay = lazy(async () => {
  const module = await import("../game/debug/debug-overlay");
  return { default: module.DebugOverlay };
});

const GameplayStage = memo(function GameplayStage({
  sceneMode,
  scenePaused,
  showPausedOverlay,
  roomId,
  joinQrValue,
  connectionStatus,
  lastError,
  matchPhase,
  countdownRemainingSeconds,
}: {
  sceneMode: "match" | "spectator";
  scenePaused: boolean;
  showPausedOverlay: boolean;
  roomId: string;
  joinQrValue: string;
  connectionStatus: HostConnectionStatus;
  lastError?: string;
  matchPhase: string;
  countdownRemainingSeconds: number;
}) {
  const [cameras, setCameras] = useState<
    Array<{
      camera: ThreePerspectiveCamera;
      viewport: { x: number; y: number; width: number; height: number };
    }>
  >([]);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(
    null,
  );

  return (
    <div className="absolute inset-0 transition-all duration-300">
      <Suspense fallback={<GameplayFallback />}>
        <GameScene
          mode={sceneMode}
          paused={scenePaused}
          onCamerasReady={setCameras}
          onCanvasReady={setCanvasElement}
        />
        {cameras.length > 0 && canvasElement ? (
          <PlayerHUDOverlay canvasElement={canvasElement} cameras={cameras} />
        ) : null}
        {showPausedOverlay ? (
          <PausedOverlay
            roomId={roomId}
            joinQrValue={joinQrValue}
            connectionStatus={connectionStatus}
            lastError={lastError}
          />
        ) : null}
        {matchPhase === "countdown" && countdownRemainingSeconds > 0 ? (
          <CountdownOverlay remainingSeconds={countdownRemainingSeconds} />
        ) : null}
      </Suspense>
    </div>
  );
});

const HostViewContent = ({
  audioMuted,
  setAudioMuted,
}: {
  audioMuted: boolean;
  setAudioMuted: Dispatch<SetStateAction<boolean>>;
}): JSX.Element => {
  const audio = useHostAudio();
  const audioRuntimeStatus = useAudioRuntimeStatus();
  const audioRuntimeControls = useAudioRuntimeControls();

  const host = useAirJamHost();
  const {
    players,
    roomId,
    connectionStatus,
    runtimeState,
    lastError,
    sendState,
    toggleRuntimeState,
  } = host;

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

  const addBot = useBotManager((state) => state.addBot);
  const removeBot = useBotManager((state) => state.removeBot);

  useHostRuntimeStateBridge({
    matchPhase,
    runtimeState,
    toggleRuntimeState,
    onEnterActivePhase: () => {
      resetMatch();
      bumpRound();
    },
    onPhaseTransition: ({ previousPhase, matchPhase: nextPhase }) => {
      if (previousPhase === "lobby" && nextPhase === "countdown") {
        resetMatch();
      }
    },
  });

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
        audio.play("player_join");
      }
    });

    connectedPlayers.forEach((player) => {
      if (!hostIds.has(player.controllerId)) {
        store.removeConnectedPlayer(player.controllerId);
      }
    });
  }, [players, audio]);

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
      if (player.source === "connected") {
        const assignedTeam = teamAssignments[player.controllerId]?.teamId;
        if (assignedTeam) {
          setPlayerTeam(player.controllerId, assignedTeam);
        }
        return;
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
    audio.play("success");
  }, [audio, ctfScores, matchActions, matchPhase, pointsToWin]);

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

  const joinQrValue = useMemo(() => {
    if (host.joinUrl) {
      return host.joinUrl;
    }

    if (!host.roomId || typeof window === "undefined") {
      return "";
    }

    return new URL(
      `/controller?room=${host.roomId}`,
      window.location.origin,
    ).toString();
  }, [host.joinUrl, host.roomId]);

  const showPausedOverlay =
    (matchPhase === "countdown" || matchPhase === "playing") &&
    runtimeState !== "playing";
  const controllerOrientation =
    matchPhase === "countdown" || matchPhase === "playing"
      ? "landscape"
      : "portrait";
  const sceneMode =
    matchPhase === "countdown" || matchPhase === "playing"
      ? "match"
      : "spectator";
  const scenePaused =
    (matchPhase !== "countdown" && matchPhase !== "playing") ||
    runtimeState !== "playing";

  useEffect(() => {
    if (connectionStatus !== "connected") {
      return;
    }

    sendState({
      orientation: controllerOrientation,
    });
  }, [connectionStatus, controllerOrientation, sendState]);
  const toggleAudio = useCallback(() => {
    setAudioMuted((current) => !current);
  }, [setAudioMuted]);

  const muteSlot = (
    <div className="pointer-events-auto absolute top-4 right-4 z-90">
      <HostMuteButton
        muted={audioMuted}
        onToggle={toggleAudio}
        className="border-white/20 bg-black/50 text-white hover:bg-black/70"
      />
    </div>
  );
  const showBackdrop = matchPhase === "lobby" || matchPhase === "ended";

  return (
    <div className="bg-background relative h-screen w-screen overflow-hidden">
      <div className="relative h-full w-full">
        {showBackdrop ? (
          <StageBackdrop />
        ) : (
          <GameplayStage
            sceneMode={sceneMode}
            scenePaused={scenePaused}
            showPausedOverlay={showPausedOverlay}
            roomId={roomId}
            joinQrValue={joinQrValue}
            connectionStatus={connectionStatus}
            lastError={lastError}
            matchPhase={matchPhase}
            countdownRemainingSeconds={countdownRemainingSeconds}
          />
        )}

        {showBackdrop ? (
          <>
            <div className="absolute inset-0 bg-radial from-transparent to-black/55" />
            {muteSlot}
            {audioRuntimeStatus === "blocked" ? (
              <AudioBlockedPrompt
                onEnable={() => {
                  void audioRuntimeControls.retry();
                }}
              />
            ) : null}
            {matchPhase === "lobby" ? (
              <LobbyOverlay
                joinQrValue={joinQrValue}
                roomId={roomId}
                pointsToWin={pointsToWin}
                botCounts={botCounts}
                connectionStatus={connectionStatus}
                lastError={lastError}
                connectedPlayers={players}
                teamPlayers={teamPlayers}
              />
            ) : (
              <EndedOverlay
                roomId={roomId}
                matchSummary={matchSummary}
                botCounts={botCounts}
                teamPlayers={teamPlayers}
              />
            )}
          </>
        ) : (
          <>
            <Suspense fallback={null}>
              <ScoreDisplay />

              <DebugOverlay>
                <PlayersSection />
                <BotsSection />
                <CTFDebugSection />
                <SceneInfoSection />
              </DebugOverlay>
            </Suspense>
            {audioRuntimeStatus === "blocked" ? (
              <AudioBlockedPrompt
                onEnable={() => {
                  void audioRuntimeControls.retry();
                }}
              />
            ) : null}
            <HostLiveChrome
              roomId={roomId}
              connectionStatus={connectionStatus}
              audioMuted={audioMuted}
              onToggleAudio={toggleAudio}
            />
          </>
        )}
      </div>
    </div>
  );
};

export const HostView = (): JSX.Element => {
  const [audioMuted, setAudioMuted] = useState(false);

  return (
    <HostAudioProvider muted={audioMuted}>
      <HostViewContent
        audioMuted={audioMuted}
        setAudioMuted={setAudioMuted}
      />
    </HostAudioProvider>
  );
};
