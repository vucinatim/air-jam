/**
 * Host surface for air-capture (the advanced reference game).
 *
 * Flow:
 *  1. `HostAudioProvider` + `HostView` mount the audio runtime and delegate
 *     to `HostScreen`.
 *  2. `HostScreen` pulls the three networked stores (match, capture-the-flag
 *     state, player/roster) and wires them to: the 3D `GameScene`, the bot
 *     manager, the visual-harness bridge, and the lobby / countdown / ended
 *     overlays picked by `matchPhase`.
 *  3. `useHostRuntimeStateBridge` aligns transport pause/play with the
 *     store's match phase. `useMatchCountdown` owns the countdown lifecycle.
 *  4. `useBotManager` runs the bot AI loop on the host against the same
 *     runtime the `GameScene` renders from.
 *
 * Heaviest piece: the 3D scene under `../game/engine/game-scene`. It's lazy-
 * loaded so the lobby surface renders before Rapier initialises.
 */
import {
  useAirJamHost,
  useAudioRuntimeControls,
  useAudioRuntimeStatus,
  useHostRuntimeStateBridge,
  type PlayerProfile,
} from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import {
  HostMuteButton,
  SurfaceViewport,
  useHostLobbyShell,
} from "@air-jam/sdk/ui";
import { useVisualHarnessBridge } from "@air-jam/visual-harness/runtime";
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
import { airCaptureVisualHarnessBridge } from "../../visual/contract";
import { HostAudioProvider } from "../game/audio/host-audio";
import { useHostAudio } from "../game/audio/use-host-audio";
import { useBotManager } from "../game/bot-system/bot-manager";
import {
  BotsSection,
  CTFDebugSection,
  PlayersSection,
  SceneInfoSection,
} from "../game/debug/debug-sections";
import { TEAM_IDS, type TeamId } from "../game/domain/team";
import { useMatchCountdown } from "../game/hooks/use-match-countdown";
import { preloadRapier } from "../game/rapier-preload";
import { useCaptureTheFlagStore } from "../game/stores/match/capture-the-flag-store";
import { usePrototypeMatchStore } from "../game/stores/match/match-store";
import { useGameStore } from "../game/stores/players/game-store";
import { PlayerHUDOverlay } from "../game/ui/player-hud-overlay";
import { HostLiveChrome } from "./components/host-live-chrome";
import {
  AudioBlockedPrompt,
  CountdownOverlay,
  EndedOverlay,
  GameplayFallback,
  LobbyOverlay,
  PausedOverlay,
  StageBackdrop,
  type HostConnectionStatus,
} from "./components/host-overlays";

const GameScene = lazy(async () => {
  await preloadRapier();
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
  hidden = false,
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
  hidden?: boolean;
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
    <div
      className={`absolute inset-0 transition-all duration-300 ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden={hidden}
    >
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

  const hostLobbyShell = useHostLobbyShell({
    joinUrl: host.joinUrl,
    onStartMatch: () => matchActions.startMatch(),
  });
  const joinQrValue = hostLobbyShell.joinUrlValue;
  const previewControllersEnabled = import.meta.env.DEV;
  useVisualHarnessBridge(airCaptureVisualHarnessBridge, {
    host,
    matchPhase,
    runtimeState,
    matchActions,
  });

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

  const showBackdrop = matchPhase === "lobby" || matchPhase === "ended";
  const activeScenePhase =
    matchPhase === "countdown" || matchPhase === "playing";
  const [sceneHasMounted, setSceneHasMounted] = useState(activeScenePhase);

  useEffect(() => {
    if (activeScenePhase) {
      setSceneHasMounted(true);
    }
  }, [activeScenePhase]);

  const shouldRenderGameplayStage = activeScenePhase || sceneHasMounted;

  return (
    <>
      <SurfaceViewport preset="host-standard" className="bg-background">
        <div className="bg-background relative h-full w-full overflow-hidden">
          {shouldRenderGameplayStage ? (
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
              hidden={showBackdrop}
            />
          ) : null}

          {showBackdrop ? <StageBackdrop /> : null}

          {showBackdrop ? (
            <>
              <div className="absolute inset-0 bg-radial from-transparent to-black/55" />
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
                  copiedJoinUrl={hostLobbyShell.copied}
                  onCopyJoinUrl={hostLobbyShell.handleCopy}
                  onOpenJoinUrl={hostLobbyShell.handleOpen}
                  joinQrVisible={hostLobbyShell.joinQrVisible}
                  onToggleJoinQr={hostLobbyShell.toggleJoinQr}
                  onCloseJoinQr={hostLobbyShell.hideJoinQr}
                  roomId={roomId}
                  pointsToWin={pointsToWin}
                  botCounts={botCounts}
                  connectedPlayers={players}
                  teamPlayers={teamPlayers}
                  onStartMatch={() => matchActions.startMatch()}
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
              />
            </>
          )}
        </div>
      </SurfaceViewport>
      <HostPreviewControllerWorkspace
        enabled={previewControllersEnabled}
        dockAccessory={
          <HostMuteButton muted={audioMuted} onToggle={toggleAudio} />
        }
      />
    </>
  );
};

export const HostView = (): JSX.Element => {
  const [audioMuted, setAudioMuted] = useState(false);

  return (
    <HostAudioProvider muted={audioMuted}>
      <HostViewContent audioMuted={audioMuted} setAudioMuted={setAudioMuted} />
    </HostAudioProvider>
  );
};
