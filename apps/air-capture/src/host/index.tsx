import {
  useAirJamHost,
  useAudio,
  useHostGameStateBridge,
  type PlayerProfile,
} from "@air-jam/sdk";
import type { JSX } from "react";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { useBotManager } from "../game/bot-system/bot-manager";
import { TEAM_IDS, type TeamId } from "../game/domain/team";
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
import { useBackgroundMusic } from "../game/audio/use-background-music";
import {
  usePrototypeMatchStore,
} from "../game/stores/match/match-store";
import { SOUND_MANIFEST } from "../game/audio/sounds";
import {
  EndedOverlay,
  GameplayFallback,
  HostMuteButton,
  LobbyOverlay,
  PausedOverlay,
  StageBackdrop,
} from "./components/host-overlays";
import {
  HostEditorPanel,
  HostLiveChrome,
} from "./components/host-live-chrome";

const GameObjectEditor = lazy(async () => {
  const module = await import("../game/debug/game-object-editor");
  return { default: module.GameObjectEditor };
});

const GameScene = lazy(async () => {
  const module = await import("../game/engine/game-scene");
  return { default: module.GameScene };
});

const PlayerHUDOverlay = lazy(async () => {
  const module = await import("../game/ui/player-hud-overlay");
  return { default: module.PlayerHUDOverlay };
});

const ScoreDisplay = lazy(async () => {
  const module = await import("../game/ui/score-display");
  return { default: module.ScoreDisplay };
});

const DebugOverlay = lazy(async () => {
  const module = await import("../game/debug/debug-overlay");
  return { default: module.DebugOverlay };
});

const HostViewContent = (): JSX.Element => {
  const audio = useAudio(SOUND_MANIFEST);
  const [audioMuted, setAudioMuted] = useState(false);

  useEffect(() => {
    audio.mute(audioMuted);
  }, [audio, audioMuted]);

  useBackgroundMusic(!audioMuted);

  const host = useAirJamHost();
  const {
    players,
    roomId,
    connectionStatus,
    gameState,
    lastError,
    sendState,
    toggleGameState,
  } = host;

  const matchPhase = usePrototypeMatchStore((state) => state.matchPhase);
  const pointsToWin = usePrototypeMatchStore((state) => state.pointsToWin);
  const botCounts = usePrototypeMatchStore((state) => state.botCounts);
  const teamAssignments = usePrototypeMatchStore(
    (state) => state.teamAssignments,
  );
  const matchSummary = usePrototypeMatchStore((state) => state.matchSummary);
  const matchActions = usePrototypeMatchStore.useActions();

  const ctfScores = useCaptureTheFlagStore((state) => state.scores);
  const resetMatch = useCaptureTheFlagStore((state) => state.resetMatch);

  const gamePlayers = useGameStore((state) => state.players);
  const setPlayerTeam = useGameStore((state) => state.setPlayerTeam);
  const bumpRound = useGameStore((state) => state.bumpRound);

  const addBot = useBotManager((state) => state.addBot);
  const removeBot = useBotManager((state) => state.removeBot);

  useHostGameStateBridge({
    phase: matchPhase,
    playingPhase: "playing",
    gameState,
    toggleGameState,
    onEnterPlayingPhase: () => {
      resetMatch();
      bumpRound();
    },
    onPhaseTransition: ({ phase }) => {
      if (phase === "lobby") {
        resetMatch();
      }
    },
  });

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
    matchActions.syncConnectedPlayers({
      connectedPlayerIds: players.map((player) => player.id),
    });
  }, [matchActions, players]);

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

  const connectedPlayers = useMemo(() => players, [players]);

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

  const showPausedOverlay = matchPhase === "playing" && gameState !== "playing";
  const controllerOrientation =
    matchPhase === "playing" ? "landscape" : "portrait";
  const sceneMode = matchPhase === "playing" ? "match" : "spectator";
  const scenePaused = matchPhase !== "playing" || gameState !== "playing";

  useEffect(() => {
    if (connectionStatus !== "connected") {
      return;
    }

    sendState({
      orientation: controllerOrientation,
    });
  }, [connectionStatus, controllerOrientation, sendState]);

  const [cameras, setCameras] = useState<
    Array<{
      camera: ThreePerspectiveCamera;
      viewport: { x: number; y: number; width: number; height: number };
    }>
  >([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorObjectType] = useState<
    "rocket" | "laser" | "ship" | "collectible" | "flag"
  >("flag");

  useEffect(() => {
    if (sceneMode !== "match") {
      setCameras([]);
    }
  }, [sceneMode]);

  const muteSlot = (
    <div className="pointer-events-auto absolute top-4 right-4 z-80">
      <HostMuteButton
        muted={audioMuted}
        onToggle={() => setAudioMuted((current) => !current)}
      />
    </div>
  );
  const showBackdrop = matchPhase !== "playing";

  return (
    <div className="bg-background relative h-screen w-screen overflow-hidden">
      <div className="relative h-full w-full">
        {showBackdrop ? (
          <StageBackdrop />
        ) : (
          <div
            className={`absolute inset-0 transition-all duration-300 ${
              isEditorOpen ? "right-1/2" : ""
            }`}
          >
            <Suspense fallback={<GameplayFallback />}>
              <GameScene
                mode={sceneMode}
                paused={scenePaused}
                onCamerasReady={setCameras}
                onCanvasReady={(canvas) => {
                  canvasRef.current = canvas;
                }}
              />
              {cameras.length > 0 && canvasRef.current ? (
                <PlayerHUDOverlay
                  canvasElement={canvasRef.current}
                  cameras={cameras}
                />
              ) : null}
              {showPausedOverlay ? (
                <PausedOverlay
                  roomId={roomId}
                  joinQrValue={joinQrValue}
                  connectionStatus={connectionStatus}
                  lastError={lastError}
                />
              ) : null}
            </Suspense>
          </div>
        )}

        {showBackdrop ? (
          <>
            <div className="absolute inset-0 bg-radial from-transparent to-black/55" />
            {muteSlot}
            {matchPhase === "lobby" ? (
              <LobbyOverlay
                joinQrValue={joinQrValue}
                roomId={roomId}
                pointsToWin={pointsToWin}
                botCounts={botCounts}
                connectionStatus={connectionStatus}
                lastError={lastError}
                connectedPlayers={connectedPlayers}
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
            <HostLiveChrome
              roomId={roomId}
              connectionStatus={connectionStatus}
              audioMuted={audioMuted}
              onToggleAudio={() => setAudioMuted((current) => !current)}
              isEditorOpen={isEditorOpen}
              onToggleEditor={() => setIsEditorOpen((current) => !current)}
            />

            <HostEditorPanel
              isOpen={isEditorOpen}
              title={`Game Object Editor - ${editorObjectType.charAt(0).toUpperCase()}${editorObjectType.slice(1)}`}
            >
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                    Loading editor…
                  </div>
                }
              >
                <GameObjectEditor objectType={editorObjectType} />
              </Suspense>
            </HostEditorPanel>
          </>
        )}
      </div>
    </div>
  );
};

export const HostView = (): JSX.Element => {
  return <HostViewContent />;
};
