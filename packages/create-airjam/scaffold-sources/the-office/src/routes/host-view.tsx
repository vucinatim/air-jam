import { useAirJamHost } from "@air-jam/sdk";
import { PlayerAvatar } from "@air-jam/sdk/ui";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { gameInputSchema } from "../game/input";
import { useGameState } from "../hooks/use-game-state";
import { GameCanvas } from "../components/game-canvas";
import { TaskSidebar } from "../components/task-sidebar";
import { GameOverOverlay } from "../components/game-over-overlay";

export function HostView() {
  const host = useAirJamHost<typeof gameInputSchema>();
  const {
    gameStateRef,
    taskManagerRef,
    pendingTasksRef,
    breakroomActivitiesRef,
    playerImagesRef,
    locationImagesRef,
    gameOver,
    finalTotalMoney,
    timeRemaining,
    initializePlayers,
    loadPlayerImages,
    loadLocationImages,
    updateGame,
    resetGame,
  } = useGameState();

  const [pendingTasks, setPendingTasks] = useState(pendingTasksRef.current);
  const pendingTasksIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const playerIds = useMemo(() => host.players.map((player) => player.id), [host.players]);

  const getInput = useCallback(
    (playerId: string) => host.getInput(playerId) ?? null,
    [host],
  );

  useEffect(() => {
    initializePlayers(playerIds);
    void loadPlayerImages();
    void loadLocationImages();
  }, [initializePlayers, loadLocationImages, loadPlayerImages, playerIds]);

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
  };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden p-2">
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
            gameStatePlaying={host.gameState === "playing"}
            updateGame={updateGame}
          />

          {gameOver ? (
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
    </div>
  );
}
