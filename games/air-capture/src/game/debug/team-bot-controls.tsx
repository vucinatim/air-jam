import { TEAM_CONFIG, type TeamId } from "../domain/team";

export const TeamBotControls = ({
  teamId,
  botCount,
  maxBots,
  disabled,
  onChange,
}: {
  teamId: TeamId;
  botCount: number;
  maxBots: number;
  disabled: boolean;
  onChange: (count: number) => void;
}) => {
  const team = TEAM_CONFIG[teamId];

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
      <div className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.14em]">
        <span style={{ color: team.color }}>{team.label}</span> Bots
      </div>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          className="rounded-md border border-white/20 bg-zinc-800 px-3 py-1 text-sm font-bold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
          disabled={disabled || botCount <= 0}
          onClick={() => onChange(botCount - 1)}
        >
          -
        </button>
        <div className="w-10 text-center text-lg font-black">{botCount}</div>
        <button
          type="button"
          className="rounded-md border border-white/20 bg-zinc-800 px-3 py-1 text-sm font-bold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
          disabled={disabled || botCount >= maxBots}
          onClick={() => onChange(botCount + 1)}
        >
          +
        </button>
      </div>
      <div className="mt-1 text-center text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        Max {maxBots}
      </div>
    </div>
  );
};
