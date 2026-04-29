/**
 * Host surface for air-capture (the advanced reference game).
 *
 * Flow:
 *  1. `HostAudioProvider` + `HostView` mount the audio runtime and delegate
 *     to `HostScreen`.
 *  2. `HostScreen` pulls the three networked stores (match, capture-the-flag
 *     state, player/roster) and wires them to: the 3D `GameScene`, the bot
 *     manager, the harness bridge, and the lobby / countdown / ended
 *     overlays picked by `matchPhase`.
 *  3. Local phase transition effects reset the match runtime. `useMatchCountdown`
 *     owns the countdown lifecycle.
 *  4. `useBotManager` runs the bot AI loop on the host against the same
 *     runtime the `GameScene` renders from.
 *
 * Heaviest piece: the 3D scene under `../game/engine/game-scene`. It's lazy-
 * loaded so the lobby surface renders before Rapier initialises.
 */
import { VisualHarnessRuntime } from "@air-jam/harness/runtime";
import { useAudioRuntimeControls, useAudioRuntimeStatus } from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import { HostMuteButton, SurfaceViewport } from "@air-jam/sdk/ui";
import type { Dispatch, JSX, SetStateAction } from "react";
import { Suspense, lazy, memo, useCallback, useState } from "react";
import { gameMetadata } from "../airjam.config";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { airCaptureVisualHarnessBridge } from "../../visual/contract";
import { HostAudioProvider } from "../game/audio/host-audio";
import { useHostAudio } from "../game/audio/use-host-audio";
import {
  BotsSection,
  CTFDebugSection,
  PlayersSection,
  SceneInfoSection,
} from "../game/debug/debug-sections";
import { preloadRapier } from "../game/rapier-preload";
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
import { useAirCaptureHostRuntime } from "./hooks/use-air-capture-host-runtime";

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
  roomId: string | null;
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
  const hostRuntime = useAirCaptureHostRuntime({
    playAudio: (soundId) => audio.play(soundId),
  });

  const toggleAudio = useCallback(() => {
    setAudioMuted((current) => !current);
  }, [setAudioMuted]);

  return (
    <>
      <VisualHarnessRuntime
        gameId={gameMetadata.slug}
        bridge={airCaptureVisualHarnessBridge}
        context={{
          host: hostRuntime.host,
          matchPhase: hostRuntime.matchPhase,
          runtimeState: hostRuntime.runtimeState,
          matchActions: hostRuntime.matchActions,
        }}
      />
      <SurfaceViewport className="bg-background">
        <div className="bg-background relative h-full w-full overflow-hidden">
          {hostRuntime.shouldRenderGameplayStage ? (
            <GameplayStage
              sceneMode={hostRuntime.sceneMode}
              scenePaused={hostRuntime.scenePaused}
              showPausedOverlay={hostRuntime.showPausedOverlay}
              roomId={hostRuntime.roomId}
              joinQrValue={hostRuntime.joinControls.joinUrlValue}
              connectionStatus={hostRuntime.connectionStatus}
              lastError={hostRuntime.lastError}
              matchPhase={hostRuntime.matchPhase}
              countdownRemainingSeconds={hostRuntime.countdownRemainingSeconds}
              hidden={hostRuntime.showBackdrop}
            />
          ) : null}

          {hostRuntime.showBackdrop ? <StageBackdrop /> : null}

          {hostRuntime.showBackdrop ? (
            <>
              <div className="absolute inset-0 bg-radial from-transparent to-black/55" />
              {audioRuntimeStatus === "blocked" ? (
                <AudioBlockedPrompt
                  onEnable={() => {
                    void audioRuntimeControls.retry();
                  }}
                />
              ) : null}
              {hostRuntime.matchPhase === "lobby" ? (
                <LobbyOverlay
                  joinQrValue={hostRuntime.joinControls.joinUrlValue}
                  copiedJoinUrl={hostRuntime.joinControls.copied}
                  onCopyJoinUrl={hostRuntime.joinControls.handleCopy}
                  onOpenJoinUrl={hostRuntime.joinControls.handleOpen}
                  joinQrVisible={hostRuntime.joinControls.joinQrVisible}
                  onToggleJoinQr={hostRuntime.joinControls.toggleJoinQr}
                  onCloseJoinQr={hostRuntime.joinControls.hideJoinQr}
                  roomId={hostRuntime.roomId}
                  pointsToWin={hostRuntime.pointsToWin}
                  botCounts={hostRuntime.botCounts}
                  connectedPlayers={hostRuntime.players}
                  teamPlayers={hostRuntime.teamPlayers}
                  onStartMatch={() => hostRuntime.matchActions.startMatch()}
                />
              ) : (
                <EndedOverlay
                  roomId={hostRuntime.roomId}
                  matchSummary={hostRuntime.matchSummary}
                  botCounts={hostRuntime.botCounts}
                  teamPlayers={hostRuntime.teamPlayers}
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
                roomId={hostRuntime.roomId}
                connectionStatus={hostRuntime.connectionStatus}
              />
            </>
          )}
        </div>
      </SurfaceViewport>
      <HostPreviewControllerWorkspace
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
