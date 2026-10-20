/**
 * Host surface for air-capture (the advanced reference game).
 *
 * Flow:
 *  1. `HostAudioProvider` + `HostView` mount the audio runtime and delegate
 *     to `HostScreen`.
 *  2. The declared simulation (`game/simulation/air-capture-simulation.ts`)
 *     plays the whole match on the SDK clock: physics, ships, bots, pickups,
 *     flags, the countdown and scoring.
 *  3. `HostScreen` draws it: the 3D `GameScene` reads the simulation, and the
 *     lobby / countdown / ended overlays follow the networked match store.
 *     `useAirCaptureFeedback` plays its sounds and phone haptics.
 *
 * Heaviest piece: the 3D scene under `../game/engine/game-scene`, lazy-loaded
 * so the lobby renders before three.js is ready. Rapier loads with the
 * simulation, on the host only.
 */
import {
  useAudioRuntimeControls,
  useAudioRuntimeStatus,
  useHostAudioMutePreference,
} from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import { HostMuteButton, SurfaceViewport } from "@air-jam/sdk/ui";
import type { JSX } from "react";
import { Suspense, lazy, memo, useState } from "react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { HostAudioProvider } from "../game/audio/host-audio";
import {
  BotsSection,
  CTFDebugSection,
  PlayersSection,
  SceneInfoSection,
} from "../game/debug/debug-sections";
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
import { useAirCaptureFeedback } from "./hooks/use-air-capture-feedback";
import { useAirCaptureHostRuntime } from "./hooks/use-air-capture-host-runtime";

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
  toggleAudioMuted,
}: {
  audioMuted: boolean;
  toggleAudioMuted: () => void;
}): JSX.Element => {
  const audioRuntimeStatus = useAudioRuntimeStatus();
  const audioRuntimeControls = useAudioRuntimeControls();
  const hostRuntime = useAirCaptureHostRuntime();
  useAirCaptureFeedback();

  return (
    <>
      <SurfaceViewport className="bg-background">
        <div className="bg-background relative h-full w-full overflow-hidden">
          {hostRuntime.shouldRenderGameplayStage ? (
            <GameplayStage
              sceneMode={hostRuntime.sceneMode}
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
          <HostMuteButton muted={audioMuted} onToggle={toggleAudioMuted} />
        }
      />
    </>
  );
};

export const HostView = (): JSX.Element => {
  const audioPreference = useHostAudioMutePreference("air-capture");

  return (
    <HostAudioProvider muted={audioPreference.muted}>
      <HostViewContent
        audioMuted={audioPreference.muted}
        toggleAudioMuted={audioPreference.toggleMuted}
      />
    </HostAudioProvider>
  );
};
