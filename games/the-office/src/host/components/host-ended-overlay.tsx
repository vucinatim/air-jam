import { useAirJamHost, useAirJamStore } from "@air-jam/sdk";
import { useMemo } from "react";
import { spaceStore, useOfficeFinalTotalMoney } from "../../game/stores";

export function OfficeHostEndedOverlay({
  onReturnToLobby,
}: {
  onReturnToLobby: () => void;
}) {
  const players = useAirJamHost((state) => state.players);
  const money = useAirJamStore(spaceStore, (state) => state.money);
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
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--airjam-color-text-dark)]/70 p-4">
      <div className="w-full max-w-2xl border border-[var(--airjam-color-paper-pale-gold)] bg-[var(--airjam-color-paper-pale-gold)] p-6 text-[var(--airjam-color-text-paper)] shadow-2xl">
        <p className="text-xs tracking-[0.2em] text-[var(--airjam-color-button)] uppercase">
          Shift Ended
        </p>
        <p className="mt-2 text-3xl font-bold">Final Earnings</p>
        <p className="mt-1 text-2xl font-bold text-[var(--airjam-color-button)]">
          EUR {finalTotalMoney}
        </p>

        <div className="mt-4 max-h-64 overflow-y-auto border border-[var(--airjam-color-border-light)] bg-[var(--airjam-color-paper)] p-3">
          {finalEarnings.length === 0 ? (
            <p className="text-sm text-[var(--airjam-color-text-gray)]">
              No connected players.
            </p>
          ) : (
            <ul className="space-y-2">
              {finalEarnings.map((entry, index) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between border-b border-[var(--airjam-color-border-light)] pb-2 text-sm last:border-0 last:pb-0"
                >
                  <span className="font-semibold">
                    {index + 1}. {entry.label}
                  </span>
                  <span className="font-bold text-[var(--airjam-color-button)]">
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
          className="mt-4 w-full rounded-none bg-[var(--airjam-color-button)] px-4 py-3 text-lg font-bold tracking-wide text-[var(--airjam-color-paper-cream)] uppercase transition hover:bg-[var(--airjam-color-button-hover)]"
        >
          Back To Lobby
        </button>
      </div>
    </div>
  );
}
