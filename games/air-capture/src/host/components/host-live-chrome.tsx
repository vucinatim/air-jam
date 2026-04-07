import { HostMuteButton } from "@air-jam/sdk/ui";
import { type HostConnectionStatus } from "./host-overlays";

export const HostLiveChrome = ({
  roomId,
  connectionStatus,
  audioMuted,
  onToggleAudio,
}: {
  roomId: string | null;
  connectionStatus: HostConnectionStatus;
  audioMuted: boolean;
  onToggleAudio: () => void;
}) => {
  return (
    <div className="absolute top-4 right-4 left-4 z-50 flex items-center justify-end gap-3 text-xs uppercase">
      <div className="mr-auto flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            connectionStatus === "connected"
              ? "bg-emerald-400"
              : connectionStatus === "connecting" ||
                  connectionStatus === "reconnecting"
                ? "bg-amber-300"
                : "bg-rose-400"
          }`}
        />
        <span className="text-white/90">
          Room <span className="font-semibold tracking-wider">{roomId || "----"}</span>
        </span>
      </div>
      <HostMuteButton
        muted={audioMuted}
        onToggle={onToggleAudio}
        className="border-white/20 bg-black/50 text-white hover:bg-black/70"
      />
    </div>
  );
};
