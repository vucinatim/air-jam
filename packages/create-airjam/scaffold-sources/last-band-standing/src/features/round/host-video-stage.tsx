import { PlayerAvatarWithFire } from "@/components/player-avatar-with-fire";
import { getRoundPrompt } from "@/features/round/round-prompt";
import { cn } from "@/lib/utils";
import { type SongEntry } from "@/song-bank";
import {
  type ActiveRound,
  type PlayerScore,
  type RoundReveal,
} from "@/store/types";
import { type GamePhase } from "@/types";
import { formatResponseTime, getLabelForPlayer } from "@/utils/player-utils";
import { type PlayerProfile } from "@air-jam/sdk";
import { motion } from "framer-motion";

const centerVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

interface HostVideoStageProps {
  phase: GamePhase;
  activeSong: SongEntry;
  embedUrl: string;
  currentRound: ActiveRound | null;
  roundReveal: RoundReveal | null;
  playerLabelById: Record<string, string>;
  scoreboardByPlayerId: Record<string, PlayerScore>;
  players: PlayerProfile[];
  youtubePlayerRef: React.RefObject<HTMLIFrameElement | null>;
  onIframeLoad: () => void;
}

export const HostVideoStage = ({
  phase,
  activeSong,
  embedUrl,
  currentRound,
  roundReveal,
  playerLabelById,
  scoreboardByPlayerId,
  players,
  youtubePlayerRef,
  onIframeLoad,
}: HostVideoStageProps) => {
  const isBlurred = phase === "round-active";

  const firstCorrectPlayer = roundReveal?.firstCorrectPlayerId
    ? (players.find((p) => p.id === roundReveal.firstCorrectPlayerId) ?? null)
    : null;
  const firstCorrectPlayerLabel = roundReveal?.firstCorrectPlayerId
    ? getLabelForPlayer(roundReveal.firstCorrectPlayerId, playerLabelById)
    : null;
  const firstCorrectPlayerHasStreakFire = roundReveal?.firstCorrectPlayerId
    ? (scoreboardByPlayerId[roundReveal.firstCorrectPlayerId]?.hasStreakFire ??
      false)
    : false;

  return (
    <motion.div
      key={`video-${activeSong.id}`}
      className="absolute inset-0"
      variants={centerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.4 }}
    >
      <iframe
        ref={youtubePlayerRef}
        title={`${activeSong.title} video`}
        src={embedUrl}
        onLoad={onIframeLoad}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />

      <motion.div
        className={cn(
          "bg-background/30 pointer-events-none absolute inset-0 backdrop-blur-xl",
        )}
        animate={{ opacity: isBlurred ? 1 : 0 }}
        transition={{ duration: 0.6 }}
      />

      {phase === "round-active" && currentRound && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className="bg-background/60 rounded-full px-6 py-3 text-3xl font-medium backdrop-blur-sm">
              {getRoundPrompt(currentRound.guessKind)}
            </span>
          </motion.div>
        </div>
      )}

      {phase === "round-reveal" && roundReveal && (
        <div className="from-background/90 absolute inset-x-0 bottom-0 h-full bg-linear-to-t to-transparent p-8">
          <motion.div
            className="mx-auto flex h-full w-full max-w-5xl flex-col items-center justify-end gap-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-muted-foreground text-sm tracking-widest uppercase">
              Round {roundReveal.roundNumber} — Answer
            </p>
            <h2 className="title text-center text-4xl md:text-5xl">
              {roundReveal.songArtist} - {roundReveal.songTitle}
            </h2>
            <p className="text-muted-foreground text-sm tracking-wider uppercase">
              Correct {roundReveal.guessKind === "artist" ? "Artist" : "Song"}
            </p>

            {roundReveal.firstCorrectResponseMs !== null &&
            firstCorrectPlayerLabel ? (
              <div className="flex justify-center">
                <div className="border-primary/30 bg-primary/10 flex items-center gap-3 rounded-2xl border px-4 py-3">
                  {firstCorrectPlayer ? (
                    <PlayerAvatarWithFire
                      player={firstCorrectPlayer}
                      size="md"
                      showFire={firstCorrectPlayerHasStreakFire}
                    />
                  ) : (
                    <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold">
                      {firstCorrectPlayerLabel.charAt(0)}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs tracking-wider uppercase">
                      Quickest
                    </span>
                    <span className="text-primary font-bold">
                      {firstCorrectPlayerLabel}
                    </span>
                    <span className="text-primary/80 text-sm font-medium">
                      {formatResponseTime(roundReveal.firstCorrectResponseMs)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm font-medium">
                Nobody got it right this round.
              </p>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};
