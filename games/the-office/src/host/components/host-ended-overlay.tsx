import { useAirJamHost } from "@air-jam/sdk";
import { useMemo } from "react";
import { useOfficeFinalTotalMoney, useSpaceStore } from "../../game/stores";

export function OfficeHostEndedOverlay({
  onReturnToLobby,
}: {
  onReturnToLobby: () => void;
}) {
  const players = useAirJamHost((state) => state.players);
  const money = useSpaceStore((state) => state.money);
  const finalTotalMoney = useOfficeFinalTotalMoney();

  const finalEarnings = useMemo(
    () =>
      players
        .map((player) => ({
          id: player.id,
          label: player.label,
          earnings: money[player.id] ?? 0,
        }))
        .sort((left, right) => right.earnings - left.earnings),
    [money, players],
  );

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1f2937]/70 p-4">
      <div className="w-full max-w-2xl border border-[#fef3c7] bg-[#fef3c7] p-6 text-[#5c4a2e] shadow-2xl">
        <p className="text-xs tracking-[0.2em] text-[#8b6914] uppercase">
          Shift Ended
        </p>
        <p className="mt-2 text-3xl font-bold">Final Earnings</p>
        <p className="mt-1 text-2xl font-bold text-[#8b6914]">
          EUR {finalTotalMoney}
        </p>

        <div className="mt-4 max-h-64 overflow-y-auto border border-[#e5d4ab] bg-[#fff6d8] p-3">
          {finalEarnings.length === 0 ? (
            <p className="text-sm text-[#6b7280]">No connected players.</p>
          ) : (
            <ul className="space-y-2">
              {finalEarnings.map((entry, index) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between border-b border-[#e5d4ab] pb-2 text-sm last:border-0 last:pb-0"
                >
                  <span className="font-semibold">
                    {index + 1}. {entry.label}
                  </span>
                  <span className="font-bold text-[#8b6914]">
                    EUR {entry.earnings}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={onReturnToLobby}
          className="mt-4 w-full rounded-none bg-[#8b6914] px-4 py-3 text-lg font-bold tracking-wide text-[#fdf6e3] uppercase transition hover:bg-[#7a5b11]"
        >
          Back To Lobby
        </button>
      </div>
    </div>
  );
}
