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
      <div className="flex min-h-0 flex-1 flex-col px-3 py-4 sm:px-4">
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-4">
          <div className="border-border/70 bg-card/70 shrink-0 rounded-2xl border p-4 backdrop-blur-sm">
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
              className="border-border bg-background text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring mt-3 h-16 w-full rounded-2xl border px-5 text-[24px] font-black transition outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60"
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3">
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

            <div className="-mx-3 min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex h-full min-h-[10rem] w-max gap-3 pb-1">
                {lobby.bucketOptions.map((bucket) => (
                  <button
                    key={bucket.id}
                    type="button"
                    disabled={!lobby.canToggleBuckets}
                    onClick={() => lobby.toggleBucket({ bucketId: bucket.id })}
                    className={cn(
                      "flex h-full w-36 snap-center flex-col justify-between rounded-2xl border bg-transparent p-4 text-left transition-all disabled:opacity-60",
                      bucket.selected
                        ? "border-primary/70 text-foreground"
                        : "border-border/60 text-muted-foreground",
                    )}
                    aria-pressed={bucket.selected}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black",
                        bucket.selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground",
                      )}
                    >
                      {bucket.selected ? "✓" : "+"}
                    </span>
                    <span>
                      <span className="block text-xl leading-tight font-black">
                        {bucket.label}
                      </span>
                      <span className="text-muted-foreground mt-2 block text-xs font-bold tracking-[0.12em] uppercase">
                        {bucket.songCount} songs
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0 space-y-3">
            <div className="min-h-[4.75rem]">
              <ControllerPrimaryAction
                label="Unready"
                helper={`${lobby.readyCount}/${lobby.playerCount} ready.`}
                disabled={!lobby.isReady || !lobby.canReadyToggle}
                onPress={lobby.toggleReady}
                className={cn(
                  "mt-0 pt-0",
                  !lobby.isReady && "pointer-events-none invisible",
                )}
                buttonClassName="bg-white text-black hover:bg-white/90 rounded-[1.5rem] shadow-lg disabled:opacity-40"
              />
            </div>

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
