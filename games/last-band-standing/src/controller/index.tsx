/**
 * Controller surface for last-band-standing.
 *
 * Phase-specific panels (lobby / active round / reveal / game-over) switch
 * on the networked `matchPhase`. The active-round panel exposes the buzz-in
 * button; the reveal panel shows round results once the host finalises them.
 */
import { AudioRuntime, useAirJamController, useAudio } from "@air-jam/sdk";
import {
  LifecycleActionGroup,
  RuntimeShellHeader,
  SurfaceViewport,
  useControllerLifecycleIntents,
  useControllerLifecyclePermissions,
  useControllerShellStatus,
} from "@air-jam/sdk/ui";
import { AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  NOW_TICK_MS,
  PLAYER_NAME_MIN_LENGTH,
  PLAYER_NAME_STORAGE_KEY,
} from "../config";
import { ControllerGameOver } from "../features/game-over/controller-game-over";
import { ControllerLobby } from "../features/lobby/controller-lobby";
import { ControllerRoundActive } from "../features/round/controller-round-active";
import { ControllerRoundReveal } from "../features/round/controller-round-reveal";
import { toShellMatchPhase } from "../game/domain/match-phase";
import { useGameStore } from "../game/stores";
import { useNowTick } from "../hooks/use-now-tick";
import { soundManifest } from "../sounds";
import { normalizePlayerName } from "../utils/player-utils";

export const ControllerView = () => {
  const controller = useAirJamController();

  return (
    <AudioRuntime manifest={soundManifest}>
      <ControllerScreen controller={controller} />
    </AudioRuntime>
  );
};

const ControllerScreen = ({
  controller,
}: {
  controller: ReturnType<typeof useAirJamController>;
}) => {
  const nowMs = useNowTick(NOW_TICK_MS);
  const [nameDraft, setNameDraft] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ?? "";
  });

  const phase = useGameStore((state) => state.phase);
  const playerOrder = useGameStore((state) => state.playerOrder);
  const playerLabelById = useGameStore((state) => state.playerLabelById);
  const readyByPlayerId = useGameStore((state) => state.readyByPlayerId);
  const activePlayerIds = useGameStore((state) => state.activePlayerIds);
  const totalRounds = useGameStore((state) => state.totalRounds);
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

  const controllerId = controller.controllerId;
  const isConnected = controller.connectionStatus === "connected";
  const isReady = controllerId
    ? (readyByPlayerId[controllerId] ?? false)
    : false;
  const isActivePlayer = controllerId
    ? activePlayerIds.includes(controllerId)
    : false;

  const readyCount = useMemo(() => {
    return playerOrder.filter((playerId) => readyByPlayerId[playerId]).length;
  }, [playerOrder, readyByPlayerId]);
  const canStartMatch =
    phase === "lobby" &&
    playerOrder.length > 0 &&
    readyCount === playerOrder.length;
  const shellPhase = toShellMatchPhase(phase);
  const shellStatus = useControllerShellStatus({
    roomId: controller.roomId,
    connectionStatus: controller.connectionStatus,
    playerLabel: nameDraft.trim() || null,
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

  const selectedOptionId = controllerId
    ? (answersByPlayerId[controllerId]?.optionId ?? null)
    : null;

  const roundCountdownSeconds = currentRound
    ? Math.max(0, Math.ceil((currentRound.endsAtMs - nowMs) / 1000))
    : 0;

  const revealCountdownSeconds = roundReveal
    ? Math.max(0, Math.ceil((roundReveal.revealEndsAtMs - nowMs) / 1000))
    : 0;

  const myRoundResult =
    controllerId && roundReveal
      ? (roundReveal.resultsByPlayerId[controllerId] ?? null)
      : null;

  // ── Sound effects ──
  const audio = useAudio();
  const prevPhaseRef = useRef<string>(phase);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (prev === phase) return;

    if (phase === "round-reveal" && myRoundResult) {
      audio.play(myRoundResult.isCorrect ? "correct" : "wrong");
    }

    if (phase === "game-over") {
      audio.play("victory");
    }
  }, [audio, phase, myRoundResult]);

  // ── Player name management ──
  const normalizedName = normalizePlayerName(nameDraft);
  const canReady = Boolean(isConnected && controllerId && phase === "lobby");
  const canReadyToggle = Boolean(
    canReady && (isReady || normalizedName.length >= PLAYER_NAME_MIN_LENGTH),
  );

  const commitPlayerName = () => {
    if (!controllerId) return;

    const nextName = normalizePlayerName(nameDraft);
    if (nextName.length < PLAYER_NAME_MIN_LENGTH) return;

    actions.setPlayerName({ name: nextName });
    controller.setNickname(nextName);
    setNameDraft(nextName);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, nextName);
    }
  };

  const toggleReady = () => {
    if (!canReadyToggle) return;
    if (!isReady) commitPlayerName();
    actions.setReady({ ready: !isReady });
  };

  const myScore = controllerId
    ? (scoreboardByPlayerId[controllerId] ?? null)
    : null;
  const myRank = controllerId
    ? finalRankingPlayerIds.indexOf(controllerId)
    : -1;

  return (
    <SurfaceViewport orientation="portrait" className="bg-background">
      <main className="text-foreground absolute inset-0 flex flex-col p-4">
        <RuntimeShellHeader
          connectionStatus={controller.connectionStatus}
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
                runtimeState={controller.runtimeState}
                canInteract={lifecyclePermissions.canInteractForPhase}
                onBackToLobby={lifecycleIntents.onBackToLobby}
                onRestart={lifecycleIntents.onRestart}
                presentation="icon"
                visibleKinds={
                  shellPhase === "playing"
                    ? ["pause-toggle", "back-to-lobby"]
                    : ["restart", "back-to-lobby"]
                }
              />
            )
          }
          className="border-border/60 bg-background/90"
        />
        <AnimatePresence mode="wait">
          {phase === "lobby" && (
            <ControllerLobby
              isConnected={isConnected}
              roomId={controller.roomId}
              readyCount={readyCount}
              playerCount={playerOrder.length}
              nameDraft={nameDraft}
              onNameChange={setNameDraft}
              onCommitReady={toggleReady}
              onStartMatch={() => actions.startMatch()}
              canReadyToggle={canReadyToggle}
              canStartMatch={canStartMatch}
              isReady={isReady}
            />
          )}

          {phase === "round-active" && currentRound && (
            <ControllerRoundActive
              currentRound={currentRound}
              totalRounds={totalRounds}
              roundCountdownSeconds={roundCountdownSeconds}
              isActivePlayer={isActivePlayer}
              selectedOptionId={selectedOptionId}
              onSubmitGuess={(optionId) => actions.submitGuess({ optionId })}
            />
          )}

          {phase === "round-reveal" && roundReveal && (
            <ControllerRoundReveal
              roundReveal={roundReveal}
              myRoundResult={myRoundResult}
              playerLabelById={playerLabelById}
              revealCountdownSeconds={revealCountdownSeconds}
            />
          )}

          {phase === "game-over" && (
            <ControllerGameOver
              controllerId={controllerId}
              myRank={myRank}
              myScore={myScore}
              finalRankingPlayerIds={finalRankingPlayerIds}
              scoreboardByPlayerId={scoreboardByPlayerId}
              playerLabelById={playerLabelById}
              onResetLobby={actions.resetLobby}
            />
          )}
        </AnimatePresence>
      </main>
    </SurfaceViewport>
  );
};
