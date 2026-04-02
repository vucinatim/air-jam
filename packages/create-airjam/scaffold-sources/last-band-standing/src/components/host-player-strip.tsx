import { type PlayerProfile } from "@air-jam/sdk";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getLabelForPlayer, createEmptyScore } from "@/utils/player-utils";
import { PlayerAvatarWithFire } from "@/components/player-avatar-with-fire";
import { type PlayerScore } from "@/store/types";
import { type GamePhase } from "@/types";

interface HostPlayerStripProps {
  phase: GamePhase;
  stripPlayerIds: string[];
  playerLabelById: Record<string, string>;
  scoreboardByPlayerId: Record<string, PlayerScore>;
  answersByPlayerId: Record<string, unknown>;
  players: PlayerProfile[];
}

export const HostPlayerStrip = ({
  phase,
  stripPlayerIds,
  playerLabelById,
  scoreboardByPlayerId,
  answersByPlayerId,
  players,
}: HostPlayerStripProps) => {
  const isPlaying = phase === "round-active" || phase === "round-reveal";
  const inGame = isPlaying || phase === "game-over";

  return (
    <div className="shrink-0 border-t border-border/30 bg-card/50 backdrop-blur-sm">
      <div className="flex items-stretch justify-center gap-2 overflow-x-auto px-4 py-3">
        <AnimatePresence mode="popLayout">
          {stripPlayerIds.map((playerId, index) => {
            const player = players.find((entry) => entry.id === playerId) ?? null;
            const score = scoreboardByPlayerId[playerId] ?? createEmptyScore();
            const hasAnswered = phase === "round-active" && Boolean(answersByPlayerId[playerId]);

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
                  "relative flex items-center gap-3 rounded-xl px-3 py-2 mx-2 my-2 transition-colors duration-300 bg-primary/10",
                  hasAnswered && "bg-primary/15 ring-2 ring-primary/40",
                )}
              >
                <div>
                  {inGame && (
                    <span
                      className={cn(
                        "absolute -left-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-bold tabular-nums",
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
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
                          {getLabelForPlayer(playerId, playerLabelById).charAt(0)}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <span className="max-w-[100px] truncate text-sm font-medium leading-tight">
                        {getLabelForPlayer(playerId, playerLabelById)}
                      </span>
                      {inGame && (
                        <span className="text-sm font-bold tabular-nums">{score.points}</span>
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
