import { type HostConnectionStatus } from "./host-overlays";

export const HostLiveChrome = ({
  roomId,
  connectionStatus,
}: {
  roomId: string | null;
  connectionStatus: HostConnectionStatus;
}) => {
  const statusLabel =
    connectionStatus === "connected"
      ? "Live"
      : connectionStatus === "connecting" || connectionStatus === "reconnecting"
        ? "Syncing"
        : "Offline";

  return (
    <div className="absolute top-4 right-4 left-4 z-50 flex items-start justify-between gap-3 text-xs uppercase">
      <div className="rounded-full border border-white/12 bg-black/45 px-3 py-2 text-white/90 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-2">
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
          <span className="text-[10px] font-semibold tracking-[0.18em] text-white/60">
            {statusLabel}
          </span>
        </div>
        <div className="mt-1 text-[11px] font-semibold tracking-[0.18em] text-white">
          Room <span className="text-white/95">{roomId || "----"}</span>
        </div>
      </div>
    </div>
  );
};
