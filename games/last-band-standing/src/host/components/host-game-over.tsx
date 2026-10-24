import { getLabelForPlayer } from "@/game/domain/player-utils";
import { rankPlayers } from "@/game/domain/round-engine";
import { gameStore } from "@/game/stores";
import { useAirJamStore } from "@air-jam/sdk";
import { motion } from "framer-motion";

const centerVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

export const HostGameOver = () => {
  const playerLabelById = useAirJamStore(
    gameStore,
    (state) => state.playerLabelById,
  );
  const totalRounds = useAirJamStore(gameStore, (state) => state.totalRounds);
  const scoreboardByPlayerId = useAirJamStore(
    gameStore,
    (state) => state.scoreboardByPlayerId,
  );
  const finalRankingPlayerIds = useAirJamStore(
    gameStore,
    (state) => state.finalRankingPlayerIds,
  );
  const actions = gameStore.actions;
  const rankingPlayerIds =
    finalRankingPlayerIds.length > 0
      ? finalRankingPlayerIds
      : rankPlayers(scoreboardByPlayerId);

  return (
    <motion.div
      key="game-over"
      className="lbs-game-over flex flex-col items-center gap-8 px-6 text-center"
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
