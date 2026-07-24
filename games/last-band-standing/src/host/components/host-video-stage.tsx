import { type SongEntry } from "@/game/content/song-bank";
import { useGameStore } from "@/game/stores";
import { cn } from "@/game/ui/classes";
import { getRoundPrompt } from "@/game/ui/round-prompt";
import { motion } from "framer-motion";
import { HostPlayerStrip } from "./host-player-strip";
import { HostRoundScoreboard } from "./host-round-scoreboard";

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
  const phase = useGameStore((state) => state.phase);
  const currentRound = useGameStore((state) => state.currentRound);
  const roundReveal = useGameStore((state) => state.roundReveal);
  const isBlurred = phase === "round-active";

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
        <div className="lbs-stage-content absolute inset-0 flex items-center justify-center px-8">
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
        <div className="from-background/90 absolute inset-0 bg-linear-to-t to-transparent">
          <motion.div
            className="lbs-reveal-layout"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="lbs-round-reveal-summary [text-shadow:0_3px_18px_rgba(0,0,0,0.85)]">
              <p className="text-muted-foreground text-sm tracking-widest uppercase">
                Round {roundReveal.roundNumber} — Answer
              </p>
              <h2 className="lbs-round-reveal-title title text-4xl md:text-5xl">
                {roundReveal.songArtist} - {roundReveal.songTitle}
              </h2>
              <p className="text-muted-foreground text-sm tracking-wider uppercase">
                Correct {roundReveal.guessKind === "artist" ? "Artist" : "Song"}
              </p>
            </div>

            <HostRoundScoreboard />
          </motion.div>
        </div>
      )}

      {phase !== "round-reveal" && <HostPlayerStrip />}
    </motion.div>
  );
};
