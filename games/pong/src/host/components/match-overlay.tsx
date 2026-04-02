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
    <div className="absolute inset-0 flex items-center justify-center bg-[#02040a]/72 px-4 backdrop-blur-md">
      <div className="pong-panel-strong flex max-w-md flex-col items-center gap-4 rounded-[28px] px-6 py-7 text-center text-white">
        <div className="pong-caption">Match Paused</div>
        <div className="text-3xl font-black uppercase tracking-[0.16em] text-white">
          Hold The Court
        </div>
        <RoomQrCode
          value={joinQrValue}
          size={170}
          className="rounded-xl border border-white/20 bg-white"
          alt="Join this Pong room"
        />
        <div className="pong-status-pill">
          Room {roomId ?? "----"}
        </div>
        <div className="max-w-xs text-sm leading-6 text-slate-300">
          Resume or return to lobby from the controller. New players can still scan in here.
        </div>
      </div>
    </div>
  );
};
