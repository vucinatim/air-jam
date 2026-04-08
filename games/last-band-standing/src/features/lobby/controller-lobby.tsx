import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ControllerLobbyProps {
  isConnected: boolean;
  roomId: string | null;
  readyCount: number;
  playerCount: number;
  nameDraft: string;
  onNameChange: (value: string) => void;
  canSaveName: boolean;
  onSaveName: () => void;
  canReadyToggle: boolean;
  isReady: boolean;
  onToggleReady: () => void;
}

export const ControllerLobby = ({
  isConnected,
  roomId,
  readyCount,
  playerCount,
  nameDraft,
  onNameChange,
  canSaveName,
  onSaveName,
  canReadyToggle,
  isReady,
  onToggleReady,
}: ControllerLobbyProps) => {
  return (
    <motion.div
      key="lobby"
      className="flex flex-1 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex flex-1 flex-col justify-center px-3 py-4 sm:px-4">
        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                  Room
                </p>
                <p className="mt-1 truncate text-base font-semibold text-foreground">
                  {isConnected ? roomId : "Connecting..."}
                </p>
              </div>
              <div className="rounded-full border border-border/70 bg-muted px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {readyCount}/{playerCount} ready
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                id="player-name"
                type="text"
                inputMode="text"
                autoCapitalize="words"
                autoCorrect="off"
                maxLength={24}
                value={nameDraft}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Enter your name"
                className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-4 text-[16px] outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <button
                type="button"
                disabled={!canSaveName}
                onClick={onSaveName}
                className="h-12 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-40 sm:w-auto"
              >
                Save
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={!canReadyToggle}
            onClick={onToggleReady}
            className={cn(
              "flex min-h-[clamp(16rem,46vh,24rem)] flex-col items-center justify-center rounded-3xl px-5 py-6 text-center shadow-lg transition-transform duration-100 active:scale-[0.98] disabled:opacity-40",
              isReady
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            <span className="text-[11px] font-semibold tracking-[0.22em] opacity-70 uppercase">
              Match Status
            </span>
            <span className="mt-3 text-4xl font-black uppercase tracking-[0.16em]">
              {isReady ? "Ready!" : "Tap to Ready"}
            </span>
            <span className="mt-3 max-w-[20ch] text-sm leading-relaxed opacity-80">
              {isReady
                ? "You are marked ready for the next round."
                : "Confirm your name above, then tap to join the match."}
            </span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};
