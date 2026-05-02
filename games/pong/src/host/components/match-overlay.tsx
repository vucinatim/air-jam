import { useAirJamHost } from "@air-jam/sdk";
import { RoomQrCode } from "@air-jam/sdk/ui";
import { gameInputSchema } from "../../game/contracts/input";

export const MatchOverlay = () => {
  const host = useAirJamHost<typeof gameInputSchema>();
  const joinUrlValue = host.joinUrl ?? "";

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#02040a]/72 px-4 backdrop-blur-md">
      <div className="pong-panel-strong flex max-w-md flex-col items-center gap-4 rounded-[28px] px-6 py-7 text-center text-white">
        <div className="pong-caption">Match Paused</div>
        <div className="text-3xl font-black tracking-[0.16em] text-white uppercase">
          Hold The Court
        </div>
        <RoomQrCode
          value={joinUrlValue}
          size={170}
          className="rounded-xl border border-white/20 bg-white"
          alt="Join this Pong room"
        />
        <div className="pong-status-pill">Room {host.roomId ?? "----"}</div>
        <div className="max-w-xs text-sm leading-6 text-slate-300">
          Resume or return to lobby from the controller. New players can still
          scan in here.
        </div>
      </div>
    </div>
  );
};
