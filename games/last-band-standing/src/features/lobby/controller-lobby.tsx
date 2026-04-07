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
      <div className="flex items-center justify-between pb-3">
        <span className="text-xs text-muted-foreground">
          {isConnected ? roomId : "Connecting..."}
        </span>
        <span className="text-xs text-muted-foreground">
          {readyCount}/{playerCount} ready
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div className="mt-2 flex gap-2">
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
            className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-[16px] outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <button
            type="button"
            disabled={!canSaveName}
            onClick={onSaveName}
            className="rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Save
          </button>
        </div>

        <button
          type="button"
          disabled={!canReadyToggle}
          onClick={onToggleReady}
          className={cn(
            "flex flex-1 items-center justify-center rounded-2xl text-3xl font-bold uppercase tracking-wider transition-transform duration-100 active:scale-[0.97] disabled:opacity-40",
            isReady
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground",
          )}
        >
          {isReady ? "Ready!" : "Tap to Ready"}
        </button>

      </div>
    </motion.div>
  );
};
