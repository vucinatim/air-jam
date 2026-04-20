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
      <div className="flex flex-1 flex-col justify-center px-3 py-4 sm:px-4">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3">
          <input
            id="player-name"
            type="text"
            inputMode="text"
            autoCapitalize="words"
            autoCorrect="off"
            maxLength={24}
            value={lobby.nameDraft}
            onChange={(event) => lobby.setNameDraft(event.target.value)}
            placeholder="Enter your name"
            className="border-border bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring h-12 w-full rounded-xl border px-4 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-foreground text-sm font-semibold">
              {lobby.isReady ? "Locked in" : "Not ready yet"}
            </p>
            <button
              type="button"
              disabled={!lobby.canReadyToggle}
              onClick={lobby.toggleReady}
              className={cn(
                "h-10 rounded-full px-4 text-[10px] font-black tracking-[0.16em] uppercase transition-colors disabled:opacity-40",
                lobby.isReady
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {lobby.isReady ? "Unready" : "Ready"}
            </button>
          </div>

          <ControllerPrimaryAction
            label="Start Match"
            helper={
              lobby.canStartMatch
                ? "Everyone is ready."
                : `${lobby.readyCount}/${lobby.playerCount} ready.`
            }
            disabled={!lobby.canStartMatch}
            onPress={lobby.startMatch}
            className="mt-auto pt-1"
            buttonClassName="rounded-[1.5rem] shadow-lg bg-primary text-primary-foreground disabled:opacity-40"
          />
        </div>
      </div>
    </motion.div>
  );
};
