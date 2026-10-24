import {
  useOfficeFinalTotalMoney,
  useOfficeGameOver,
  useOfficeMatchPhase,
} from "../../game/stores";
import type { OfficeHostSession } from "../hooks/use-office-host-session";
import {
  useOfficeFeedback,
  useOfficePendingTasks,
} from "../hooks/use-office-match-view";
import { GameCanvas } from "./game-canvas";
import { GameOverOverlay } from "./game-over-overlay";
import { TaskSidebar } from "./task-sidebar";

/** Draws the match the simulation plays; it decides nothing itself. */
export function OfficeHostGameplaySurface({
  muted,
  session,
}: {
  muted: boolean;
  session: OfficeHostSession;
}) {
  const matchPhase = useOfficeMatchPhase();
  const gameOver = useOfficeGameOver();
  const finalTotalMoney = useOfficeFinalTotalMoney();
  const pendingTasks = useOfficePendingTasks();
  useOfficeFeedback(muted);

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <TaskSidebar pendingTasks={pendingTasks} />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <GameCanvas players={session.players} />

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
