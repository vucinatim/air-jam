import {
  createEmptyScore,
  getLabelForPlayer,
} from "@/game/domain/player-utils";
import { useGameStore } from "@/game/stores";
import { cn } from "@/game/ui/classes";
import { PlayerAvatarWithFire } from "@/game/ui/player-avatar-with-fire";
import { VerticalLogo } from "@/game/ui/vertical-logo";
import { MenuVideoBackground } from "@/host/components/menu-video-background";
import { useAirJamHost } from "@air-jam/sdk";
import {
  JoinQrOverlay,
  JoinUrlControls,
  LifecycleActionGroup,
  useHostJoinControls,
} from "@air-jam/sdk/ui";
import { AnimatePresence, motion } from "framer-motion";

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

export const HostLobby = () => {
  const host = useAirJamHost();
  const roomId = useAirJamHost((state) => state.roomId);
  const lastError = useAirJamHost((state) => state.lastError);
  const players = useAirJamHost((state) => state.players);
  const phase = useGameStore((state) => state.phase);
  const playerOrder = useGameStore((state) => state.playerOrder);
  const playerLabelById = useGameStore((state) => state.playerLabelById);
  const readyByPlayerId = useGameStore((state) => state.readyByPlayerId);
  const scoreboardByPlayerId = useGameStore(
    (state) => state.scoreboardByPlayerId,
  );
  const actions = useGameStore.useActions();
  const readyCount = playerOrder.filter(
    (playerId) => readyByPlayerId[playerId],
  ).length;
  const canStartMatch =
    phase === "lobby" &&
    playerOrder.length > 0 &&
    readyCount === playerOrder.length;
  const hostJoinControls = useHostJoinControls({
    joinUrl: host.joinUrl,
    canStartMatch,
    onStartMatch: () => actions.startMatch(),
  });
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
        <div className="bg-background/40 pointer-events-none absolute inset-0 z-1" />

        <div className="relative z-2 flex h-full w-full flex-col items-center justify-center gap-8 px-4 py-6 sm:py-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="flex shrink-0 flex-col items-center gap-2"
          >
            <VerticalLogo
              size={hasPlayers ? 150 : 256}
              className="text-foreground"
            />
            <p className="text-muted-foreground pt-2 text-center text-lg">
              Destroy your friends. Musically speaking, of course.
            </p>
          </motion.div>

          <div className="flex w-full max-w-[640px] flex-col items-center gap-5">
            <motion.div
              layout
              className={cn(
                "flex w-full flex-col items-center gap-3",
                hasPlayers && "opacity-80",
              )}
              transition={{
                layout: { type: "spring", stiffness: 300, damping: 30 },
              }}
            >
              {lastError && (
                <p className="text-destructive max-w-[340px] text-center text-xs">
                  {lastError}
                </p>
              )}
              <p
                className={cn(
                  "text-muted-foreground",
                  hasPlayers ? "text-sm" : "text-lg",
                )}
              >
                {hasPlayers
                  ? "More friends? Open the QR overlay to join."
                  : "Open the QR overlay to join the game."}
              </p>
              <JoinUrlControls
                value={hostJoinControls.joinUrlValue}
                label="Controller link"
                copied={hostJoinControls.copied}
                onCopy={hostJoinControls.handleCopy}
                onOpen={hostJoinControls.handleOpen}
                qrVisible={hostJoinControls.joinQrVisible}
                onToggleQr={hostJoinControls.toggleJoinQr}
                helperText="Copy or open the controller URL for quick joins."
                className="w-full"
                inputClassName="border-border/30 bg-card/40 text-foreground"
                buttonClassName="border-border/30 bg-background/60 text-foreground hover:bg-background/80"
              />
            </motion.div>

            {hasPlayers && (
              <motion.div
                className="flex w-full flex-col items-center gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex max-w-full flex-wrap items-center justify-center gap-3">
                  <AnimatePresence mode="popLayout">
                    {playerOrder.map((playerId, index) => {
                      const player =
                        players.find((entry) => entry.id === playerId) ?? null;
                      const isReady = readyByPlayerId[playerId] ?? false;
                      const score =
                        scoreboardByPlayerId[playerId] ?? createEmptyScore();

                      return (
                        <motion.div
                          key={playerId}
                          layout
                          variants={playerCardVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          transition={{
                            layout: {
                              type: "spring",
                              stiffness: 400,
                              damping: 30,
                            },
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
                              <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold">
                                {getLabelForPlayer(
                                  playerId,
                                  playerLabelById,
                                ).charAt(0)}
                              </div>
                            )}
                            <div
                              className={cn(
                                "absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 transition-colors",
                                isReady
                                  ? "border-primary/30 bg-primary"
                                  : "border-card bg-muted-foreground/40",
                              )}
                            />
                          </div>
                          <span className="max-w-[100px] truncate text-sm font-medium">
                            {getLabelForPlayer(playerId, playerLabelById)}
                          </span>
                          <span
                            className={cn(
                              "text-xs font-medium",
                              isReady
                                ? "text-primary"
                                : "text-muted-foreground",
                            )}
                          >
                            {isReady ? "Ready" : "Waiting..."}
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                <motion.p
                  className="text-muted-foreground text-center text-lg"
                  key={allReady ? "all-ready" : "waiting"}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {allReady
                    ? "All players ready!"
                    : `${readyCount}/${playerOrder.length} ready`}
                </motion.p>

                <LifecycleActionGroup
                  phase="lobby"
                  canInteract={canStartMatch}
                  onStart={hostJoinControls.handleStart}
                  startLabel="Start Match"
                  buttonClassName="rounded-2xl bg-primary px-8 py-3 text-base font-bold uppercase tracking-wider text-primary-foreground transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  className="justify-center"
                />
              </motion.div>
            )}
          </div>
        </div>
        <JoinQrOverlay
          open={hostJoinControls.joinQrVisible}
          value={hostJoinControls.joinUrlValue}
          roomId={roomId}
          onClose={hostJoinControls.hideJoinQr}
          description="Scan with your phone to join Last Band Standing as a controller."
        />
      </div>
    </motion.div>
  );
};
