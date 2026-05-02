import type { TeamId } from "../domain/team";

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
  return (
    <div
      className="flex items-center justify-center gap-2"
      data-testid={`air-capture-bot-controls-${teamId}`}
    >
      <span className="text-[10px] font-semibold tracking-[0.12em] text-zinc-400 uppercase">
        Bots
      </span>
      <button
        type="button"
        data-testid={`air-capture-bot-controls-${teamId}-decrement`}
        className="rounded-md border border-white/20 bg-zinc-800 px-2.5 py-0.5 text-sm font-bold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
        disabled={disabled || botCount <= 0}
        onClick={() => onChange(botCount - 1)}
      >
        -
      </button>
      <div className="w-6 text-center text-sm font-black">{botCount}</div>
      <button
        type="button"
        data-testid={`air-capture-bot-controls-${teamId}-increment`}
        className="rounded-md border border-white/20 bg-zinc-800 px-2.5 py-0.5 text-sm font-bold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
        disabled={disabled || botCount >= maxBots}
        onClick={() => onChange(botCount + 1)}
      >
        +
      </button>
    </div>
  );
};
