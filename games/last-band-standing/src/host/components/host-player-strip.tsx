import {
  createEmptyScore,
  getLabelForPlayer,
} from "@/game/domain/player-utils";
import { rankPlayers } from "@/game/domain/round-engine";
import { useGameStore } from "@/game/stores";
import { cn } from "@/game/ui/classes";
import { PlayerAvatarWithFire } from "@/game/ui/player-avatar-with-fire";
import { useAirJamHost } from "@air-jam/sdk";
import { AnimatePresence, motion } from "framer-motion";

export const HostPlayerStrip = () => {
  const players = useAirJamHost((state) => state.players);
  const phase = useGameStore((state) => state.phase);
  const playerOrder = useGameStore((state) => state.playerOrder);
  const playerLabelById = useGameStore((state) => state.playerLabelById);
  const answersByPlayerId = useGameStore((state) => state.answersByPlayerId);
  const scoreboardByPlayerId = useGameStore(
    (state) => state.scoreboardByPlayerId,
  );
  const finalRankingPlayerIds = useGameStore(
    (state) => state.finalRankingPlayerIds,
  );
  const isPlaying = phase === "round-active" || phase === "round-reveal";
  const inGame = isPlaying || phase === "game-over";
  const rankingPlayerIds =
    phase === "game-over" && finalRankingPlayerIds.length > 0
      ? finalRankingPlayerIds
      : rankPlayers(scoreboardByPlayerId);
  const stripPlayerIds = inGame ? rankingPlayerIds : playerOrder;

  return (
    <div className="border-border/30 bg-card/50 shrink-0 border-t backdrop-blur-sm">
      <div className="flex items-stretch justify-center gap-2 overflow-x-auto px-4 py-3">
        <AnimatePresence mode="popLayout">
          {stripPlayerIds.map((playerId, index) => {
            const player =
              players.find((entry) => entry.id === playerId) ?? null;
            const score = scoreboardByPlayerId[playerId] ?? createEmptyScore();
            const hasAnswered =
              phase === "round-active" && Boolean(answersByPlayerId[playerId]);

            return (
              <motion.div
                key={playerId}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  scale: hasAnswered ? 1.05 : 1,
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                  layout: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                  scale: { type: "spring", stiffness: 400, damping: 15 },
                }}
                className={cn(
                  "bg-primary/10 relative flex items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-300",
                  hasAnswered && "bg-primary/15 ring-primary/40 ring-2",
                )}
              >
                <div>
                  {inGame && (
                    <span
                      className={cn(
                        "absolute -top-2 -left-2 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-bold tabular-nums",
                        index === 0 && "bg-amber-400 text-amber-950",
                        index === 1 && "bg-slate-300 text-slate-800",
                        index === 2 && "bg-amber-600 text-amber-100",
                        index > 2 && "bg-white/90 text-slate-800",
                      )}
                    >
                      #{index + 1}
                    </span>
                  )}

                  <div className="flex items-center gap-3 p-1">
                    <div className="relative shrink-0">
                      {player ? (
                        <PlayerAvatarWithFire
                          player={player}
                          size="sm"
                          showFire={score.hasStreakFire}
                        />
                      ) : (
                        <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
                          {getLabelForPlayer(playerId, playerLabelById).charAt(
                            0,
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <span className="max-w-[100px] truncate text-sm leading-tight font-medium">
                        {getLabelForPlayer(playerId, playerLabelById)}
                      </span>
                      {inGame && (
                        <span className="text-sm font-bold tabular-nums">
                          {score.points}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
