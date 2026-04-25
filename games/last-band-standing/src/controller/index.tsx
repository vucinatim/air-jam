/**
 * Controller surface for last-band-standing.
 *
 * Phase-specific panels (lobby / active round / reveal / game-over) switch
 * on the networked `matchPhase`. The active-round panel exposes the buzz-in
 * button; the reveal panel shows round results once the host finalises them.
 */
import { AudioRuntime, useAirJamController } from "@air-jam/sdk";
import {
  LifecycleActionGroup,
  RuntimeShellHeader,
  SurfaceViewport,
  useControllerLifecycleIntents,
  useControllerLifecyclePermissions,
  useControllerShellStatus,
} from "@air-jam/sdk/ui";
import { AnimatePresence } from "framer-motion";
import { getUniqueSongCountForBuckets } from "../game/content/song-bank";
import { soundManifest } from "../game/contracts/sounds";
import { toShellMatchPhase } from "../game/domain/match-phase";
import { useGameStore } from "../game/stores";
import { ControllerGameOver } from "./components/controller-game-over";
import { ControllerLobby } from "./components/controller-lobby";
import { ControllerMatchCountdown } from "./components/controller-match-countdown";
import { ControllerRoundActive } from "./components/controller-round-active";
import { ControllerRoundReveal } from "./components/controller-round-reveal";
import { useControllerAudioCues } from "./hooks/use-controller-audio-cues";

export const ControllerView = () => {
  return (
    <AudioRuntime manifest={soundManifest}>
      <ControllerScreen />
    </AudioRuntime>
  );
};

const ControllerScreen = () => {
  const roomId = useAirJamController((state) => state.roomId);
  const connectionStatus = useAirJamController(
    (state) => state.connectionStatus,
  );
  const runtimeState = useAirJamController((state) => state.runtimeState);
  const selfPlayerLabel = useAirJamController(
    (state) => state.selfPlayer?.label ?? null,
  );
  const phase = useGameStore((state) => state.phase);
  const playerOrder = useGameStore((state) => state.playerOrder);
  const readyByPlayerId = useGameStore((state) => state.readyByPlayerId);
  const totalRounds = useGameStore((state) => state.totalRounds);
  const selectedSongBucketIds = useGameStore(
    (state) => state.selectedSongBucketIds,
  );
  const actions = useGameStore.useActions();
  useControllerAudioCues();

  const isConnected = connectionStatus === "connected";
  const readyCount = playerOrder.filter(
    (playerId) => readyByPlayerId[playerId],
  ).length;
  const hasEnoughSongs =
    getUniqueSongCountForBuckets(selectedSongBucketIds) >= totalRounds;
  const canStartMatch =
    phase === "lobby" &&
    playerOrder.length > 0 &&
    readyCount === playerOrder.length &&
    hasEnoughSongs;
  const shellPhase = toShellMatchPhase(phase);
  const shellStatus = useControllerShellStatus({
    roomId,
    connectionStatus,
    playerLabel: selfPlayerLabel,
  });
  const lifecyclePermissions = useControllerLifecyclePermissions({
    phase: shellPhase,
    canStartMatch: canStartMatch && isConnected,
    canSendSystemCommand: isConnected,
  });
  const lifecycleIntents = useControllerLifecycleIntents({
    onStart: () => actions.startMatch(),
    onBackToLobby: () => actions.resetLobby(),
    onRestart: () => actions.resetLobby(),
  });

  return (
    <SurfaceViewport orientation="portrait" className="bg-background">
      <main className="text-foreground absolute inset-0 flex flex-col p-4">
        <RuntimeShellHeader
          connectionStatus={connectionStatus}
          leftSlot={
            <div className="flex min-w-0 items-center gap-3">
              <span className="border-border bg-background text-foreground flex h-9 w-9 items-center justify-center rounded-full border text-[10px] font-bold uppercase">
                {shellStatus.identityInitial || "ME"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {shellStatus.displayName}
                </p>
                <p className="text-muted-foreground text-[10px] tracking-[0.16em] uppercase">
                  {shellStatus.roomLine}
                </p>
              </div>
            </div>
          }
          rightSlot={
            shellPhase === "lobby" ? null : (
              <LifecycleActionGroup
                phase={shellPhase}
                runtimeState={runtimeState}
                canInteract={lifecyclePermissions.canInteractForPhase}
                onBackToLobby={lifecycleIntents.onBackToLobby}
                onRestart={lifecycleIntents.onRestart}
                presentation="icon"
                visibleKinds={
                  shellPhase === "playing"
                    ? ["pause-toggle", "back-to-lobby"]
                    : ["back-to-lobby"]
                }
              />
            )
          }
          className="border-border/60 bg-background/90"
        />
        <AnimatePresence mode="wait">
          {phase === "lobby" && <ControllerLobby />}

          {phase === "match-countdown" && <ControllerMatchCountdown />}

          {phase === "round-active" && <ControllerRoundActive />}

          {phase === "round-reveal" && <ControllerRoundReveal />}

          {phase === "game-over" && <ControllerGameOver />}
        </AnimatePresence>
      </main>
    </SurfaceViewport>
  );
};
