/**
 * Host surface for last-band-standing.
 *
 * This host drives a round-based music quiz: a YouTube clip plays on the
 * main screen, controllers buzz in, and the host advances the round
 * lifecycle through the networked `useGameStore`. The YouTube player
 * wrapper in `../features/youtube` handles cued playback without exposing
 * the iframe API directly to the rest of the code.
 */
import {
  AudioRuntime,
  useAirJamHost,
  useAudio,
  useHostRuntimeStateBridge,
} from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import {
  HostMuteButton,
  SurfaceViewport,
  useHostLobbyShell,
} from "@air-jam/sdk/ui";
import { useVisualHarnessBridge } from "@air-jam/visual-harness/runtime";
import { AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { lastBandStandingVisualHarnessBridge } from "../../visual/contract";
import { FullscreenToggle } from "../components/fullscreen-toggle";
import { HostPlayerStrip } from "../components/host-player-strip";
import { HostTimerBar } from "../components/host-timer-bar";
import { HostTopBar } from "../components/host-top-bar";
import { FINALIZE_POLL_MS, NOW_TICK_MS } from "../config";
import { HostGameOver } from "../features/game-over/host-game-over";
import { HostLobby } from "../features/lobby/host-lobby";
import { HostVideoStage } from "../features/round/host-video-stage";
import { getYouTubeEmbedUrl, useYouTubePlayer } from "../features/youtube";
import { toShellMatchPhase } from "../game/domain/match-phase";
import { rankPlayers } from "../game/domain/round-engine";
import { gameInputSchema } from "../game/input";
import { useGameStore } from "../game/stores";
import { useNowTick } from "../hooks/use-now-tick";
import { getSongById } from "../song-bank";
import { soundManifest } from "../sounds";

export const HostView = () => {
  return (
    <AudioRuntime manifest={soundManifest}>
      <HostScreen />
    </AudioRuntime>
  );
};

const HostScreen = () => {
  const host = useAirJamHost<typeof gameInputSchema>();
  const nowMs = useNowTick(NOW_TICK_MS);

  const phase = useGameStore((state) => state.phase);
  const playerOrder = useGameStore((state) => state.playerOrder);
  const playerLabelById = useGameStore((state) => state.playerLabelById);
  const readyByPlayerId = useGameStore((state) => state.readyByPlayerId);
  const totalRounds = useGameStore((state) => state.totalRounds);
  const revealDurationSec = useGameStore((state) => state.revealDurationSec);
  const currentRound = useGameStore((state) => state.currentRound);
  const answersByPlayerId = useGameStore((state) => state.answersByPlayerId);
  const roundReveal = useGameStore((state) => state.roundReveal);
  const scoreboardByPlayerId = useGameStore(
    (state) => state.scoreboardByPlayerId,
  );
  const finalRankingPlayerIds = useGameStore(
    (state) => state.finalRankingPlayerIds,
  );
  const actions = useGameStore.useActions();

  // ── Sound effects ──
  const audio = useAudio();
  const [audioMuted, setAudioMuted] = useState(false);
  const prevPhaseRef = useRef<string>(phase);
  const prevCountdownRef = useRef<number | null>(null);

  useEffect(() => {
    audio.mute(audioMuted);
  }, [audio, audioMuted]);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (prev === phase) return;

    if (phase === "round-active") {
      audio.play("round-start");
    }

    if (phase === "round-reveal" && roundReveal) {
      const anyCorrect = Object.values(roundReveal.resultsByPlayerId).some(
        (r) => r.isCorrect,
      );
      audio.play(anyCorrect ? "correct" : "wrong");
    }

    if (phase === "game-over") {
      audio.play("victory");
    }
  }, [audio, phase, roundReveal]);

  // ── Sync players from Air Jam host ──
  const playersForStore = useMemo(
    () =>
      host.players.map((player) => ({ id: player.id, label: player.label })),
    [host.players],
  );
  const playersSignature = playersForStore
    .map((player) => `${player.id}:${player.label}`)
    .join("|");

  useEffect(() => {
    actions.setPlayers({ players: playersForStore });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, playersSignature]);

  // ── Round finalization polling ──
  useEffect(() => {
    if (phase !== "round-active") return;
    const id = window.setInterval(() => {
      actions.finalizeRound({ nowMs: Date.now() });
    }, FINALIZE_POLL_MS);
    return () => window.clearInterval(id);
  }, [actions, phase]);

  // ── Auto-advance from reveal ──
  useEffect(() => {
    if (phase !== "round-reveal" || !roundReveal) return;
    const delayMs = Math.max(0, roundReveal.revealEndsAtMs - Date.now()) + 25;
    const id = window.setTimeout(() => {
      actions.advanceFromReveal({ nowMs: Date.now() });
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [actions, phase, roundReveal]);

  // ── Derived state ──
  const readyCount = useMemo(() => {
    return playerOrder.filter((playerId) => readyByPlayerId[playerId]).length;
  }, [playerOrder, readyByPlayerId]);
  const canStartMatch =
    phase === "lobby" &&
    playerOrder.length > 0 &&
    readyCount === playerOrder.length;
  const hostLobbyShell = useHostLobbyShell({
    joinUrl: host.joinUrl,
    canStartMatch,
    onStartMatch: () => actions.startMatch(),
  });
  const previewControllersEnabled = import.meta.env.DEV;

  const answeredCount = currentRound
    ? currentRound.expectedPlayerIds.filter(
        (playerId) => answersByPlayerId[playerId],
      ).length
    : 0;

  const activeSong = useMemo(() => {
    if (phase === "round-active" && currentRound)
      return getSongById(currentRound.songId);
    if (phase === "round-reveal" && roundReveal)
      return getSongById(roundReveal.songId);
    return null;
  }, [phase, currentRound, roundReveal]);

  const embedUrl = activeSong
    ? getYouTubeEmbedUrl(activeSong.youtubeUrl, true)
    : null;

  const countdownSeconds = currentRound
    ? Math.max(0, Math.ceil((currentRound.endsAtMs - nowMs) / 1000))
    : 0;

  // ── Countdown tick sounds ──
  useEffect(() => {
    if (phase !== "round-active") {
      prevCountdownRef.current = null;
      return;
    }
    if (
      prevCountdownRef.current !== null &&
      countdownSeconds < prevCountdownRef.current &&
      countdownSeconds > 0 &&
      countdownSeconds <= 5
    ) {
      audio.play("countdown-tick");
    }
    prevCountdownRef.current = countdownSeconds;
  }, [audio, phase, countdownSeconds]);

  // ── YouTube player hook ──
  const { youtubePlayerRef, onIframeLoad } = useYouTubePlayer({
    phase,
    embedUrl,
    muted: audioMuted,
    currentRound,
    roundReveal,
    revealDurationSec,
    finalizeRound: actions.finalizeRound,
  });

  const revealCountdownSeconds = roundReveal
    ? Math.max(0, Math.ceil((roundReveal.revealEndsAtMs - nowMs) / 1000))
    : 0;

  const rankingPlayerIds =
    phase === "game-over" && finalRankingPlayerIds.length > 0
      ? finalRankingPlayerIds
      : rankPlayers(scoreboardByPlayerId);

  const shellPhase = toShellMatchPhase(phase);
  useVisualHarnessBridge(lastBandStandingVisualHarnessBridge, {
    host,
    matchPhase: shellPhase,
    runtimeState: host.runtimeState,
    actions,
  });

  useHostRuntimeStateBridge({
    matchPhase: shellPhase,
    runtimeState: host.runtimeState,
    toggleRuntimeState: host.toggleRuntimeState,
  });

  const isPlaying = shellPhase === "playing";
  const showVideo = isPlaying && activeSong && embedUrl;

  const stripPlayerIds =
    isPlaying || phase === "game-over" ? rankingPlayerIds : playerOrder;

  const countdownFraction = currentRound
    ? Math.max(
        0,
        Math.min(
          1,
          (currentRound.endsAtMs - nowMs) /
            (currentRound.endsAtMs - currentRound.startedAtMs || 1),
        ),
      )
    : 0;

  return (
    <>
      <SurfaceViewport preset="host-standard" className="bg-background">
        <main className="bg-background text-foreground flex h-full w-full flex-col overflow-hidden">
          {phase !== "lobby" && (
            <HostTopBar
              phase={phase}
              currentRound={currentRound}
              roundReveal={roundReveal}
              totalRounds={totalRounds}
              answeredCount={answeredCount}
              countdownSeconds={countdownSeconds}
              revealCountdownSeconds={revealCountdownSeconds}
            />
          )}

          {phase === "round-active" && (
            <HostTimerBar countdownFraction={countdownFraction} />
          )}

          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait">
              {phase === "lobby" && (
                <HostLobby
                  joinUrl={hostLobbyShell.joinUrlValue}
                  copiedJoinUrl={hostLobbyShell.copied}
                  onCopyJoinUrl={hostLobbyShell.handleCopy}
                  onOpenJoinUrl={hostLobbyShell.handleOpen}
                  joinQrVisible={hostLobbyShell.joinQrVisible}
                  onToggleJoinQr={hostLobbyShell.toggleJoinQr}
                  onCloseJoinQr={hostLobbyShell.hideJoinQr}
                  roomId={host.roomId}
                  lastError={host.lastError ?? null}
                  playerOrder={playerOrder}
                  playerLabelById={playerLabelById}
                  readyByPlayerId={readyByPlayerId}
                  scoreboardByPlayerId={scoreboardByPlayerId}
                  readyCount={readyCount}
                  players={host.players}
                  canStartMatch={canStartMatch}
                  onStartMatch={hostLobbyShell.handleStart}
                />
              )}

              {showVideo && (
                <HostVideoStage
                  phase={phase}
                  activeSong={activeSong}
                  embedUrl={embedUrl}
                  currentRound={currentRound}
                  roundReveal={roundReveal}
                  playerLabelById={playerLabelById}
                  scoreboardByPlayerId={scoreboardByPlayerId}
                  players={host.players}
                  youtubePlayerRef={youtubePlayerRef}
                  onIframeLoad={onIframeLoad}
                />
              )}

              {phase === "game-over" && (
                <HostGameOver
                  rankingPlayerIds={rankingPlayerIds}
                  playerLabelById={playerLabelById}
                  totalRounds={totalRounds}
                  onResetLobby={actions.resetLobby}
                />
              )}
            </AnimatePresence>
          </div>

          {phase !== "lobby" && (
            <HostPlayerStrip
              phase={phase}
              stripPlayerIds={stripPlayerIds}
              playerLabelById={playerLabelById}
              scoreboardByPlayerId={scoreboardByPlayerId}
              answersByPlayerId={answersByPlayerId}
              players={host.players}
            />
          )}
        </main>
      </SurfaceViewport>
      <HostPreviewControllerWorkspace
        enabled={previewControllersEnabled}
        dockAccessory={
          <div className="flex items-center gap-2">
            <HostMuteButton
              muted={audioMuted}
              onToggle={() => setAudioMuted((previous) => !previous)}
            />
            <FullscreenToggle className="border border-white/25 bg-black/35 text-white backdrop-blur-sm hover:bg-black/55" />
          </div>
        }
      />
    </>
  );
};
