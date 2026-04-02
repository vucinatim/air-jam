import { type PlayerProfile } from "@air-jam/sdk";
import { RoomQrCode } from "@air-jam/sdk/ui";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getLabelForPlayer, createEmptyScore } from "@/utils/player-utils";
import { VerticalLogo } from "@/assets/vertical-logo";
import { MenuVideoBackground } from "@/components/ui/menu-video-background";
import { PlayerAvatarWithFire } from "@/components/player-avatar-with-fire";
import { type PlayerScore } from "@/store/types";

const centerVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

const playerCardVariants = {
  initial: { opacity: 0, y: 20, scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.9 },
};

interface HostLobbyProps {
  joinUrl: string | null;
  connectionStatus: string;
  lastError: string | null;
  playerOrder: string[];
  playerLabelById: Record<string, string>;
  readyByPlayerId: Record<string, boolean>;
  scoreboardByPlayerId: Record<string, PlayerScore>;
  readyCount: number;
  players: PlayerProfile[];
}

export const HostLobby = ({
  joinUrl,
  connectionStatus,
  lastError,
  playerOrder,
  playerLabelById,
  readyByPlayerId,
  scoreboardByPlayerId,
  readyCount,
  players,
}: HostLobbyProps) => {
  const hasPlayers = playerOrder.length > 0;
  const allReady = readyCount === playerOrder.length && readyCount > 0;

  return (
    <motion.div
      key="lobby"
      className="absolute inset-0"
      variants={centerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.4 }}
    >
      <div className="relative h-full w-full overflow-hidden">
        <MenuVideoBackground className="absolute inset-0 z-0" />
        <div className="pointer-events-none absolute inset-0 z-1 bg-background/40" />

        <div className="relative z-2 flex h-full w-full flex-col items-center justify-between py-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="flex shrink-0 flex-col items-center gap-2"
          >
            <VerticalLogo size={hasPlayers ? 156 : 256} className="text-foreground" />
            <p className="text-center text-lg text-muted-foreground pt-2">
              Destroy your friends. Musically speaking, of course.
            </p>
          </motion.div>

          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <motion.div
              layout
              className={cn(
                "flex flex-col items-center gap-3",
                hasPlayers && "opacity-80",
              )}
              transition={{ layout: { type: "spring", stiffness: 300, damping: 30 } }}
            >
              {joinUrl ? (
                <RoomQrCode
                  value={joinUrl}
                  foregroundColor="#f5f6fa"
                  backgroundColor="#00000000"
                  errorCorrectionLevel="H"
                  size={hasPlayers ? 140 : 220}
                  className={hasPlayers ? "h-[100px] w-[100px]" : "h-[160px] w-[160px]"}
                  alt="Scan to join"
                />
              ) : (
                <div className={cn(
                  "flex items-center justify-center rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md",
                  hasPlayers ? "h-[120px] w-[120px]" : "h-[200px] w-[200px]",
                )}>
                  <span className="px-3 text-center text-sm text-muted-foreground">
                    {connectionStatus === "connecting"
                      ? "Connecting..."
                      : lastError
                        ? "Connection failed"
                        : "Generating QR..."}
                  </span>
                </div>
              )}
              {lastError && (
                <p className="max-w-[340px] text-center text-xs text-destructive">
                  {lastError}
                </p>
              )}
              <p className={cn(
                "text-muted-foreground",
                hasPlayers ? "text-sm" : "text-lg",
              )}>
                {hasPlayers ? "More friends? Scan to join" : "Scan to join the game"}
              </p>
            </motion.div>

            {hasPlayers && (
              <motion.div
                className="flex flex-col items-center gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <AnimatePresence mode="popLayout">
                    {playerOrder.map((playerId, index) => {
                      const player = players.find((entry) => entry.id === playerId) ?? null;
                      const isReady = readyByPlayerId[playerId] ?? false;
                      const score = scoreboardByPlayerId[playerId] ?? createEmptyScore();

                      return (
                        <motion.div
                          key={playerId}
                          layout
                          variants={playerCardVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          transition={{
                            layout: { type: "spring", stiffness: 400, damping: 30 },
                            delay: index * 0.05,
                          }}
                          className={cn(
                            "flex min-w-[120px] flex-col items-center gap-2 rounded-2xl border px-5 py-4 backdrop-blur-md transition-all",
                            isReady
                              ? "border-primary/40 bg-primary/10"
                              : "border-border/40 bg-card/40",
                          )}
                        >
                          <div className="relative">
                            {player ? (
                              <PlayerAvatarWithFire
                                player={player}
                                size="md"
                                showFire={score.hasStreakFire}
                              />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-bold">
                                {getLabelForPlayer(playerId, playerLabelById).charAt(0)}
                              </div>
                            )}
                            <div className={cn(
                              "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 transition-colors",
                              isReady
                                ? "border-primary/30 bg-primary"
                                : "border-card bg-muted-foreground/40",
                            )} />
                          </div>
                          <span className="max-w-[100px] truncate text-sm font-medium">
                            {getLabelForPlayer(playerId, playerLabelById)}
                          </span>
                          <span className={cn(
                            "text-xs font-medium",
                            isReady ? "text-primary" : "text-muted-foreground",
                          )}>
                            {isReady ? "Ready" : "Waiting..."}
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                <motion.p
                  className="text-lg text-muted-foreground"
                  key={allReady ? "all-ready" : "waiting"}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {allReady
                    ? "All players ready!"
                    : `${readyCount}/${playerOrder.length} ready`}
                </motion.p>
              </motion.div>
            )}
          </div>

          <div className="shrink-0" />
        </div>
      </div>
    </motion.div>
  );
};
