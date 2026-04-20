import { type SongEntry } from "@/game/content/song-bank";
import {
  formatResponseTime,
  getLabelForPlayer,
} from "@/game/domain/player-utils";
import { useGameStore } from "@/game/stores";
import { cn } from "@/game/ui/classes";
import { PlayerAvatarWithFire } from "@/game/ui/player-avatar-with-fire";
import { getRoundPrompt } from "@/game/ui/round-prompt";
import { useAirJamHost } from "@air-jam/sdk";
import { motion } from "framer-motion";
import { HostPlayerStrip } from "./host-player-strip";

const centerVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

interface HostVideoStageProps {
  activeSong: SongEntry;
  embedUrl: string;
  youtubePlayerRef: React.RefObject<HTMLIFrameElement | null>;
  onIframeLoad: () => void;
}

export const HostVideoStage = ({
  activeSong,
  embedUrl,
  youtubePlayerRef,
  onIframeLoad,
}: HostVideoStageProps) => {
  const players = useAirJamHost((state) => state.players);
  const phase = useGameStore((state) => state.phase);
  const currentRound = useGameStore((state) => state.currentRound);
  const roundReveal = useGameStore((state) => state.roundReveal);
  const playerLabelById = useGameStore((state) => state.playerLabelById);
  const scoreboardByPlayerId = useGameStore(
    (state) => state.scoreboardByPlayerId,
  );
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
        <div className="absolute inset-0 flex items-center justify-center px-8 pb-28">
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
        <div className="from-background/80 absolute inset-0 bg-linear-to-t to-transparent p-8">
          <motion.div
            className="mx-auto flex h-full w-full max-w-5xl flex-col items-center justify-center gap-4 pb-28"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="bg-background/25 flex flex-col items-center gap-3 rounded-3xl px-8 py-5 text-center shadow-[0_22px_80px_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-md [text-shadow:0_3px_18px_rgba(0,0,0,0.85)]">
              <p className="text-muted-foreground text-sm tracking-widest uppercase">
                Round {roundReveal.roundNumber} — Answer
              </p>
              <h2 className="title text-4xl md:text-5xl">
                {roundReveal.songArtist} - {roundReveal.songTitle}
              </h2>
              <p className="text-muted-foreground text-sm tracking-wider uppercase">
                Correct {roundReveal.guessKind === "artist" ? "Artist" : "Song"}
              </p>
            </div>

            {roundReveal.firstCorrectResponseMs !== null &&
            firstCorrectPlayerLabel ? (
              <div className="flex justify-center">
                <div className="border-primary/45 bg-background/65 shadow-primary/10 flex items-center gap-3 rounded-2xl border px-5 py-4 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
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

      <HostPlayerStrip />
    </motion.div>
  );
};
