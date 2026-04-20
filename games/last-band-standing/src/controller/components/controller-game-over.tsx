import {
  formatAverageResponseTime,
  getLabelForPlayer,
} from "@/game/domain/player-utils";
import { rankPlayers } from "@/game/domain/round-engine";
import { useGameStore } from "@/game/stores";
import { cn } from "@/game/ui/classes";
import { useAirJamController } from "@air-jam/sdk";
import { motion } from "framer-motion";

export const ControllerGameOver = () => {
  const controllerId = useAirJamController((state) => state.controllerId);
  const playerLabelById = useGameStore((state) => state.playerLabelById);
  const scoreboardByPlayerId = useGameStore(
    (state) => state.scoreboardByPlayerId,
  );
  const finalRankingPlayerIds = useGameStore(
    (state) => state.finalRankingPlayerIds,
  );
  const actions = useGameStore.useActions();
  const rankingPlayerIds =
    finalRankingPlayerIds.length > 0
      ? finalRankingPlayerIds
      : rankPlayers(scoreboardByPlayerId);
  const myScore = controllerId
    ? (scoreboardByPlayerId[controllerId] ?? null)
    : null;
  const myRank = controllerId ? rankingPlayerIds.indexOf(controllerId) : -1;

  return (
    <motion.div
      key="game-over"
      className="flex flex-1 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5">
        <p className="text-muted-foreground text-sm tracking-widest uppercase">
          Your Placement
        </p>
        <p className="title text-7xl">#{myRank >= 0 ? myRank + 1 : "?"}</p>
        {myScore && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-2xl font-bold">{myScore.points} pts</p>
            <p className="text-muted-foreground text-sm">
              {myScore.correct} correct · {myScore.wrong} wrong
            </p>
            <p className="text-muted-foreground text-xs">
              Avg answer:{" "}
              {formatAverageResponseTime(
                myScore.totalResponseMs,
                myScore.answeredRounds,
              )}
            </p>
          </div>
        )}

        <div className="mt-4 flex w-full flex-col gap-1">
          {rankingPlayerIds.map((playerId, index) => {
            const score = scoreboardByPlayerId[playerId];
            if (!score) return null;
            const isMe = playerId === controllerId;

            return (
              <motion.div
                key={playerId}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-2",
                  isMe ? "bg-primary/15" : "bg-transparent",
                )}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground w-5 text-sm font-bold tabular-nums">
                    {index + 1}
                  </span>
                  <div className="flex flex-col items-start">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isMe && "text-primary",
                      )}
                    >
                      {getLabelForPlayer(playerId, playerLabelById)}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      Avg:{" "}
                      {formatAverageResponseTime(
                        score.totalResponseMs,
                        score.answeredRounds,
                      )}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-bold tabular-nums">
                  {score.points}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={actions.resetLobby}
          className="bg-primary text-primary-foreground flex h-14 w-full items-center justify-center rounded-2xl text-lg font-bold transition-all active:scale-[0.98]"
        >
          Back To Lobby
        </button>
      </div>
    </motion.div>
  );
};
