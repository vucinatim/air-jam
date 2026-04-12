import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ControllerPrimaryAction } from "@air-jam/sdk/ui";

interface ControllerLobbyProps {
  isConnected: boolean;
  roomId: string | null;
  readyCount: number;
  playerCount: number;
  nameDraft: string;
  onNameChange: (value: string) => void;
  onCommitReady: () => void;
  onStartMatch: () => void;
  canReadyToggle: boolean;
  canStartMatch: boolean;
  isReady: boolean;
}

export const ControllerLobby = ({
  isConnected: _isConnected,
  roomId: _roomId,
  readyCount,
  playerCount,
  nameDraft,
  onNameChange,
  onCommitReady,
  onStartMatch,
  canReadyToggle,
  canStartMatch,
  isReady,
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
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3">
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
            className="h-12 w-full rounded-xl border border-border bg-background px-4 text-[16px] outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              {isReady ? "Locked in" : "Not ready yet"}
            </p>
            <button
              type="button"
              disabled={!canReadyToggle}
              onClick={onCommitReady}
              className={cn(
                "h-10 rounded-full px-4 text-[10px] font-black tracking-[0.16em] uppercase transition-colors disabled:opacity-40",
                isReady
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {isReady ? "Unready" : "Ready"}
            </button>
          </div>

          <ControllerPrimaryAction
            label="Start Match"
            helper={
              canStartMatch
                ? "Everyone is ready."
                : `${readyCount}/${playerCount} ready.`
            }
            disabled={!canStartMatch}
            onPress={onStartMatch}
            className="mt-auto pt-1"
            buttonClassName="rounded-[1.5rem] shadow-lg bg-primary text-primary-foreground disabled:opacity-40"
          />
        </div>
      </div>
    </motion.div>
  );
};
