import { cn } from "@/game/ui/classes";
import { ControllerPrimaryAction } from "@air-jam/sdk/ui";
import { motion } from "framer-motion";
import { useControllerLobbyState } from "../hooks/use-controller-lobby-state";

export const ControllerLobby = () => {
  const lobby = useControllerLobbyState();

  return (
    <motion.div
      key="lobby"
      className="flex flex-1 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-4">
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-3">
          <div className="shrink-0 px-1">
            <label
              htmlFor="player-name"
              className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase"
            >
              Playing as
            </label>
            <input
              id="player-name"
              type="text"
              inputMode="text"
              autoCapitalize="words"
              autoCorrect="off"
              autoComplete="nickname"
              enterKeyHint="done"
              maxLength={24}
              disabled={!lobby.canEditName}
              value={lobby.nameDraft}
              onFocus={lobby.focusNameInput}
              onBlur={lobby.blurNameInput}
              onChange={(event) => lobby.updateNameDraft(event.target.value)}
              placeholder={lobby.canEditName ? "Enter your name" : "Connecting"}
              className="border-border/70 bg-card/50 text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring mt-2 h-14 w-full rounded-xl border px-4 text-xl font-black transition outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60"
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2.5">
            <div className="flex shrink-0 items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
                  Song Buckets
                </p>
                <p className="text-foreground mt-1 text-sm font-bold">
                  {lobby.selectedBucketCount}/{lobby.bucketOptions.length}{" "}
                  selected
                </p>
              </div>
              <p
                className={cn(
                  "shrink-0 text-right text-[11px] font-bold tracking-[0.08em] uppercase",
                  lobby.hasEnoughSongs ? "text-primary" : "text-destructive",
                )}
              >
                {lobby.hasEnoughSongs
                  ? `${lobby.uniqueSongCount} songs`
                  : `${lobby.totalRounds - lobby.uniqueSongCount} short`}
              </p>
            </div>

            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="grid grid-cols-2 gap-2 pb-1">
                {lobby.bucketOptions.map((bucket) => (
                  <button
                    key={bucket.id}
                    type="button"
                    disabled={!lobby.canToggleBuckets}
                    onClick={() => lobby.toggleBucket({ bucketId: bucket.id })}
                    className={cn(
                      "flex min-h-14 min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all disabled:opacity-60",
                      bucket.selected
                        ? "border-primary/80 bg-primary/10 text-foreground"
                        : "border-border/60 text-muted-foreground bg-transparent",
                    )}
                    aria-pressed={bucket.selected}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-black",
                        bucket.selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground",
                      )}
                    >
                      {bucket.selected ? "✓" : "+"}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm leading-tight font-black break-words">
                        {bucket.label}
                      </span>
                      <span className="text-muted-foreground mt-1 block text-[10px] font-bold tracking-[0.1em] uppercase">
                        {bucket.songCount} songs
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0 space-y-2.5">
            {lobby.isReady && (
              <ControllerPrimaryAction
                label="Unready"
                helper={`${lobby.readyCount}/${lobby.playerCount} ready.`}
                disabled={!lobby.canReadyToggle}
                onPress={lobby.toggleReady}
                className="mt-0 pt-0"
                buttonClassName="bg-white text-black hover:bg-white/90 rounded-[1.5rem] shadow-lg disabled:opacity-40"
              />
            )}

            <ControllerPrimaryAction
              label={lobby.isReady ? "Start Match" : "Ready Up"}
              helper={
                lobby.isReady
                  ? lobby.readyCount === lobby.playerCount
                    ? lobby.startMatchHelper
                    : `${lobby.readyCount}/${lobby.playerCount} ready.`
                  : "Lock in for the next round."
              }
              disabled={
                lobby.isReady ? !lobby.canStartMatch : !lobby.canReadyToggle
              }
              onPress={lobby.isReady ? lobby.startMatch : lobby.toggleReady}
              buttonClassName="bg-primary text-primary-foreground rounded-[1.5rem] shadow-lg disabled:opacity-40"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
