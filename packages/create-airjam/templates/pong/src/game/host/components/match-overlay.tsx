import { RoomQrCode } from "@air-jam/sdk/ui";

interface MatchOverlayProps {
  joinQrValue: string;
  roomId: string | null;
}

export const MatchOverlay = ({
  joinQrValue,
  roomId,
}: MatchOverlayProps) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-white/20 bg-black/70 p-5 text-center text-white">
        <div className="text-xs uppercase tracking-[0.22em] text-zinc-400">Match Paused</div>
        <RoomQrCode
          value={joinQrValue}
          size={170}
          className="rounded-md border border-white/20 bg-white"
          alt="Join this Pong room"
        />
        <div className="text-xs uppercase">
          <span className="text-zinc-400">Room </span>
          <span className="font-semibold tracking-wider text-white">
            {roomId ?? "----"}
          </span>
        </div>
        <div className="text-xs text-zinc-300">Resume or return to lobby from controller.</div>
      </div>
    </div>
  );
};
