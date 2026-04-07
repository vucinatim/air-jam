import { useAirJamHost, useHostGameStateBridge } from "@air-jam/sdk";
import { HostMuteButton, PlayerAvatar } from "@air-jam/sdk/ui";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { gameInputSchema } from "../game/input";
import { useGameState } from "../hooks/use-game-state";
import { GameCanvas } from "../components/game-canvas";
import { TaskSidebar } from "../components/task-sidebar";
import { GameOverOverlay } from "../components/game-over-overlay";
import { useSpaceStore } from "../game/stores";
import { getPlayerById, getPlayerCapabilityHighlights } from "../players";

export function HostView() {
  const host = useAirJamHost<typeof gameInputSchema>();
  const [audioMuted, setAudioMuted] = useState(false);
  const {
    gameStateRef,
    taskManagerRef,
    pendingTasksRef,
    breakroomActivitiesRef,
    playerImagesRef,
    locationImagesRef,
    gameOver,
    finalTotalMoney,
    money,
    timeRemaining,
    initializePlayers,
    loadPlayerImages,
    loadLocationImages,
    updateGame,
    startMatch,
    resetGame,
  } = useGameState({ muted: audioMuted });
  const readyByPlayerId = useSpaceStore((state) => state.readyByPlayerId);
  const playerAssignments = useSpaceStore((state) => state.playerAssignments);
  const matchPhase = useSpaceStore((state) => state.matchPhase);
  const storeActions = useSpaceStore.useActions();

  const [pendingTasks, setPendingTasks] = useState(pendingTasksRef.current);
  const pendingTasksIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRosterKeyRef = useRef<string | null>(null);
  const imagesPreloadedRef = useRef(false);
  const playerIds = useMemo(() => host.players.map((player) => player.id), [host.players]);
  const readyCount = useMemo(
    () =>
      playerIds.filter((playerId) => readyByPlayerId[playerId] ?? false).length,
    [playerIds, readyByPlayerId],
  );
  const selectedCount = useMemo(
    () => playerIds.filter((playerId) => Boolean(playerAssignments[playerId])).length,
    [playerAssignments, playerIds],
  );
  const finalEarnings = useMemo(
    () =>
      host.players
        .map((player) => ({
          id: player.id,
          label: player.label,
          earnings: money[player.id] ?? 0,
        }))
        .sort((left, right) => right.earnings - left.earnings),
    [host.players, money],
  );
  const allReady = playerIds.length > 0 && readyCount === playerIds.length;
  const canStartMatch =
    matchPhase === "lobby" &&
    allReady &&
    host.connectionStatus === "connected";

  useHostGameStateBridge({
    phase: matchPhase,
    playingPhase: "playing",
    gameState: host.gameState,
    toggleGameState: host.toggleGameState,
  });

  const prevRuntimeGameStateRef = useRef(host.gameState);
  useEffect(() => {
    const previousRuntimeState = prevRuntimeGameStateRef.current;
    prevRuntimeGameStateRef.current = host.gameState;

    if (matchPhase !== "playing") {
      return;
    }

    if (
      previousRuntimeState === "playing" &&
      host.gameState !== "playing"
    ) {
      storeActions.setMatchPhase({ phase: "lobby" });
    }
  }, [host.gameState, matchPhase, storeActions]);

  const getInput = useCallback(
    (playerId: string) => host.getInput(playerId) ?? null,
    [host],
  );

  useEffect(() => {
    const rosterKey = [...playerIds].sort().join(",");
    if (initializedRosterKeyRef.current === rosterKey) {
      return;
    }
    initializedRosterKeyRef.current = rosterKey;
    initializePlayers(playerIds);
  }, [initializePlayers, playerIds]);

  useEffect(() => {
    if (imagesPreloadedRef.current) {
      return;
    }
    imagesPreloadedRef.current = true;
    void loadPlayerImages();
    void loadLocationImages();
  }, [loadLocationImages, loadPlayerImages]);

  useEffect(() => {
    pendingTasksIntervalRef.current = setInterval(() => {
      setPendingTasks(pendingTasksRef.current);
    }, 500);

    return () => {
      if (pendingTasksIntervalRef.current) {
        clearInterval(pendingTasksIntervalRef.current);
      }
    };
  }, [pendingTasksRef]);

  const handleRestart = () => {
    resetGame(playerIds);
    initializePlayers(playerIds);
  };

  const handleStart = () => {
    if (!canStartMatch) return;
    startMatch();
  };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden p-2">
      <div className="absolute right-3 top-3 z-30">
        <HostMuteButton
          muted={audioMuted}
          onToggle={() => setAudioMuted((previous) => !previous)}
          className="border-[#8b6914]/45 bg-[#fff6d8]/90 text-[#5c4a2e] hover:bg-[#fef3c7]"
          labelClassName="tracking-[0.14em]"
        />
      </div>

      <div className="mb-4 flex w-full items-center justify-center gap-8 text-center">
        <span className="text-3xl font-bold text-foreground">
          EUR {finalTotalMoney}
        </span>
        <span className="inline-block w-20 text-center text-2xl font-bold text-foreground">
          {Math.floor(timeRemaining / 60000)}:
          {String(Math.floor((timeRemaining % 60000) / 1000)).padStart(2, "0")}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <TaskSidebar pendingTasks={pendingTasks} />

        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          <GameCanvas
            gameStateRef={gameStateRef}
            taskManagerRef={taskManagerRef}
            breakroomActivitiesRef={breakroomActivitiesRef}
            playerImagesRef={playerImagesRef}
            locationImagesRef={locationImagesRef}
            getInput={getInput}
            players={host.players}
            gameStatePlaying={
              matchPhase === "playing" && host.gameState === "playing"
            }
            updateGame={updateGame}
          />

          {matchPhase === "playing" && gameOver ? (
            <GameOverOverlay
              totalMoney={finalTotalMoney}
              onRestart={handleRestart}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex gap-4">
        {host.players.slice(0, 2).map((player) => (
          <PlayerAvatar key={player.id} player={player} size="sm" />
        ))}
      </div>

      {matchPhase === "lobby" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1f2937]/70 p-4">
          <div className="w-full max-w-2xl border border-[#fef3c7] bg-[#fef3c7] p-6 text-[#5c4a2e] shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8b6914]">Room</p>
                <p className="text-xl font-bold">{host.roomId ?? "----"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-[#8b6914]">Picked</p>
                <p className="text-xl font-bold">
                  {selectedCount}/{playerIds.length}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-[#8b6914]">Ready</p>
                <p className="text-xl font-bold">
                  {readyCount}/{playerIds.length}
                </p>
              </div>
            </div>

            <div className="mb-4 max-h-64 overflow-y-auto border border-[#e5d4ab] bg-[#fff6d8] p-3">
              {host.players.length === 0 ? (
                <p className="text-sm text-[#6b7280]">Waiting for controllers to join…</p>
              ) : (
                <ul className="space-y-2">
                  {host.players.map((player) => {
                    const selectedCharacterId = playerAssignments[player.id];
                    const selectedCharacter = selectedCharacterId
                      ? getPlayerById(selectedCharacterId)
                      : null;
                    const highlights = selectedCharacterId
                      ? getPlayerCapabilityHighlights(selectedCharacterId, 2)
                      : [];

                    return (
                      <li
                        key={player.id}
                        className="border-b border-[#e5d4ab] pb-2 text-sm last:border-0 last:pb-0"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{player.label}</p>
                            <p className="text-xs text-[#8b6914]">
                              {selectedCharacter ? selectedCharacter.name : "No character selected"}
                            </p>
                          </div>
                          <span className="font-semibold">
                            {(readyByPlayerId[player.id] ?? false) ? "Ready" : "Not ready"}
                          </span>
                        </div>
                        {selectedCharacter ? (
                          <div className="mt-2 flex items-start gap-2">
                            <img
                              src={selectedCharacter.image}
                              alt={selectedCharacter.name}
                              className="h-10 w-10 rounded object-cover"
                            />
                            <div className="space-y-1 text-[11px] text-[#5c4a2e]">
                              {highlights.map((highlight) => (
                                <p key={`${selectedCharacter.id}:${highlight.taskId}`}>
                                  {highlight.label}: {highlight.level}/5 • {(highlight.durationMs / 1000).toFixed(0)}s
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <button
              type="button"
              disabled={!canStartMatch}
              onClick={handleStart}
              className="w-full bg-[#8b6914] px-4 py-3 text-lg font-bold uppercase tracking-wide text-[#fdf6e3] transition enabled:hover:bg-[#7a5b11] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start Match
            </button>
          </div>
        </div>
      ) : null}

      {matchPhase === "ended" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1f2937]/70 p-4">
          <div className="w-full max-w-2xl border border-[#fef3c7] bg-[#fef3c7] p-6 text-[#5c4a2e] shadow-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-[#8b6914]">
              Shift Ended
            </p>
            <p className="mt-2 text-3xl font-bold">Final Earnings</p>
            <p className="mt-1 text-2xl font-bold text-[#8b6914]">
              EUR {finalTotalMoney}
            </p>

            <div className="mt-4 max-h-64 overflow-y-auto border border-[#e5d4ab] bg-[#fff6d8] p-3">
              {finalEarnings.length === 0 ? (
                <p className="text-sm text-[#6b7280]">No connected players.</p>
              ) : (
                <ul className="space-y-2">
                  {finalEarnings.map((entry, index) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between border-b border-[#e5d4ab] pb-2 text-sm last:border-0 last:pb-0"
                    >
                      <span className="font-semibold">
                        {index + 1}. {entry.label}
                      </span>
                      <span className="font-bold text-[#8b6914]">
                        EUR {entry.earnings}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              onClick={handleRestart}
              className="mt-4 w-full bg-[#8b6914] px-4 py-3 text-lg font-bold uppercase tracking-wide text-[#fdf6e3] transition hover:bg-[#7a5b11]"
            >
              Back To Lobby
            </button>
          </div>
        </div>
      ) : null}

      {matchPhase === "playing" && host.gameState !== "playing" ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#1f2937]/45 p-4">
          <div className="w-full max-w-sm border border-[#fef3c7] bg-[#fef3c7] p-4 text-center text-[#5c4a2e] shadow-xl">
            <p className="text-xs uppercase tracking-[0.2em] text-[#8b6914]">
              Match Paused
            </p>
            <p className="mt-2 text-sm text-[#6b7280]">
              Waiting for runtime reconnect...
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
