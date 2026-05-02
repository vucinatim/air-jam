import { getLabelForPlayer } from "@/game/domain/player-utils";
import { rankPlayers } from "@/game/domain/round-engine";
import { useGameStore } from "@/game/stores";
import { motion } from "framer-motion";

const centerVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

export const HostGameOver = () => {
  const playerLabelById = useGameStore((state) => state.playerLabelById);
  const totalRounds = useGameStore((state) => state.totalRounds);
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

  return (
    <motion.div
      key="game-over"
      className="flex flex-col items-center gap-8"
      variants={centerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.4 }}
    >
      <p className="text-muted-foreground text-sm tracking-widest uppercase">
        Game Over
      </p>
      <h1 className="title text-5xl md:text-7xl">
        {rankingPlayerIds[0]
          ? getLabelForPlayer(rankingPlayerIds[0], playerLabelById)
          : "Nobody"}{" "}
        Wins!
      </h1>
      <p className="text-muted-foreground text-lg">
        After {totalRounds} rounds
      </p>
      <button
        type="button"
        className="bg-primary text-primary-foreground hover:bg-primary/80 mt-4 rounded-full px-8 py-3 text-lg font-medium transition-colors"
        onClick={actions.resetLobby}
      >
        Back To Lobby
      </button>
    </motion.div>
  );
};
