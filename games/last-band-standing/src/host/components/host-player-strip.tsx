import {
  createEmptyScore,
  formatAverageResponseTime,
  formatResponseTime,
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
  const currentRound = useGameStore((state) => state.currentRound);
  const roundReveal = useGameStore((state) => state.roundReveal);
  const answersByPlayerId = useGameStore((state) => state.answersByPlayerId);
  const scoreboardByPlayerId = useGameStore(
    (state) => state.scoreboardByPlayerId,
  );
  const finalRankingPlayerIds = useGameStore(
    (state) => state.finalRankingPlayerIds,
  );
  const isPlaying =
    phase === "match-countdown" ||
    phase === "round-active" ||
    phase === "round-reveal";
  const inGame = isPlaying || phase === "game-over";
  const rankingPlayerIds =
    phase === "game-over" && finalRankingPlayerIds.length > 0
      ? finalRankingPlayerIds
      : rankPlayers(scoreboardByPlayerId);
  const stripPlayerIds = inGame ? rankingPlayerIds : playerOrder;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-5">
      <div className="flex items-stretch justify-center gap-3 overflow-x-auto pt-20 pb-10">
        <AnimatePresence mode="popLayout">
          {stripPlayerIds.map((playerId, index) => {
            const player =
              players.find((entry) => entry.id === playerId) ?? null;
            const score = scoreboardByPlayerId[playerId] ?? createEmptyScore();
            const answer = answersByPlayerId[playerId] ?? null;
            const roundResult =
              roundReveal?.resultsByPlayerId[playerId] ?? null;
            const hasAnswered = phase === "round-active" && Boolean(answer);
            const responseLabel = (() => {
              if (
                roundResult?.responseMs !== null &&
                roundResult?.responseMs !== undefined
              ) {
                return formatResponseTime(roundResult.responseMs);
              }

              if (answer && currentRound) {
                return formatResponseTime(
                  answer.answeredAtMs - currentRound.startedAtMs,
                );
              }

              return null;
            })();

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
                  "relative min-w-[11rem] rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white shadow-2xl backdrop-blur-md transition-colors duration-300",
                  hasAnswered && "ring-primary/50 bg-primary/20 ring-2",
                  roundResult?.isCorrect === true &&
                    "ring-primary/60 bg-primary/25",
                  roundResult?.isCorrect === false &&
                    "ring-destructive/50 bg-destructive/20",
                )}
              >
                {inGame && (
                  <span
                    className={cn(
                      "absolute -top-2 -left-2 flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-xs font-black tabular-nums shadow-lg",
                      index === 0 && "bg-amber-400 text-amber-950",
                      index === 1 && "bg-slate-300 text-slate-800",
                      index === 2 && "bg-amber-600 text-amber-100",
                      index > 2 && "bg-white/90 text-slate-800",
                    )}
                  >
                    #{index + 1}
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    {player ? (
                      <PlayerAvatarWithFire
                        player={player}
                        size="md"
                        showFire={score.hasStreakFire}
                      />
                    ) : (
                      <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full text-base font-bold">
                        {getLabelForPlayer(playerId, playerLabelById).charAt(0)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="block max-w-[140px] truncate text-base leading-tight font-black">
                      {getLabelForPlayer(playerId, playerLabelById)}
                    </span>
                    <div className="mt-1 flex flex-col text-lg font-bold tabular-nums">
                      <span>{score.points} pts</span>
                      <span>{score.correct} correct</span>
                    </div>
                    <div className="mt-1 text-sm font-medium text-white/70">
                      {responseLabel
                        ? `Answer ${responseLabel}`
                        : `Avg ${formatAverageResponseTime(
                            score.totalResponseMs,
                            score.answeredRounds,
                          )}`}
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
