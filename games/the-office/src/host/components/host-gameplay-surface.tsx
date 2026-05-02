import { useGetInput, useHostTick } from "@air-jam/sdk";
import { useCallback, useEffect, useRef } from "react";
import { gameInputSchema } from "../../game/contracts/input";
import {
  useOfficeFinalTotalMoney,
  useOfficeGameOver,
  useOfficeMatchPhase,
} from "../../game/stores";
import {
  useOfficeActiveMatchClock,
  useOfficeGameRuntime,
  useOfficePendingTasks,
} from "../hooks/use-office-game-runtime";
import type { OfficeHostSession } from "../hooks/use-office-host-session";
import { GameCanvas } from "./game-canvas";
import { GameOverOverlay } from "./game-over-overlay";
import { TaskSidebar } from "./task-sidebar";

const OFFICE_SIMULATION_STEP_MS = 1000 / 60;

export function OfficeHostGameplaySurface({
  muted,
  session,
  matchClock,
}: {
  muted: boolean;
  session: OfficeHostSession;
  matchClock: Pick<
    ReturnType<typeof useOfficeActiveMatchClock>,
    "advanceElapsedMs" | "elapsedMsRef"
  >;
}) {
  const getInput = useGetInput<typeof gameInputSchema>();
  const matchPhase = useOfficeMatchPhase();
  const gameOver = useOfficeGameOver();
  const finalTotalMoney = useOfficeFinalTotalMoney();
  const {
    gameStateRef,
    taskManagerRef,
    pendingTasksRef,
    breakroomActivitiesRef,
    playerImagesRef,
    locationImagesRef,
    loadPlayerImages,
    loadLocationImages,
    updateGame,
  } = useOfficeGameRuntime({
    muted,
    connectedPlayerIds: session.playerIds,
  });
  const pendingTasks = useOfficePendingTasks(pendingTasksRef);
  const imagesPreloadedRef = useRef(false);
  const renderFrameRef = useRef<(() => void) | null>(null);

  const getInputForPlayer = useCallback(
    (playerId: string) => getInput(playerId) ?? null,
    [getInput],
  );
  const gameStatePlaying =
    matchPhase === "playing" && session.runtimeState === "playing";

  useHostTick({
    enabled: matchPhase !== "lobby",
    mode: "fixed",
    intervalMs: OFFICE_SIMULATION_STEP_MS,
    onTick: ({ deltaMs }) => {
      if (!gameStatePlaying) {
        return;
      }

      const matchElapsedMs = matchClock.advanceElapsedMs(deltaMs);
      updateGame(matchElapsedMs, session.players, getInputForPlayer, true);
    },
    onFrame: () => {
      renderFrameRef.current?.();
    },
  });

  useEffect(() => {
    if (imagesPreloadedRef.current) {
      return;
    }

    imagesPreloadedRef.current = true;
    void loadPlayerImages();
    void loadLocationImages();
  }, [loadLocationImages, loadPlayerImages]);

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <TaskSidebar pendingTasks={pendingTasks} />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <GameCanvas
          gameStateRef={gameStateRef}
          taskManagerRef={taskManagerRef}
          breakroomActivitiesRef={breakroomActivitiesRef}
          playerImagesRef={playerImagesRef}
          locationImagesRef={locationImagesRef}
          matchElapsedMsRef={matchClock.elapsedMsRef}
          renderFrameRef={renderFrameRef}
          players={session.players}
        />

        {matchPhase === "playing" && gameOver ? (
          <GameOverOverlay
            totalMoney={finalTotalMoney}
            onRestart={session.returnToLobby}
          />
        ) : null}
      </div>
    </div>
  );
}
