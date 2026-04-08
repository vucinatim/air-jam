import { PlayerAvatar } from "@air-jam/sdk/ui";
import type { TeamSlotVisual } from "../domain/team-slots";

const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(" ");

const BOT_AVATAR_PLAYER = {
  id: "bot-slot",
  label: "Bot Slot",
  color: "#22d3ee",
} as const;

type TeamSlotTileProps = {
  slot: TeamSlotVisual;
  testId: string;
  onBotAction?: () => void;
  disabled?: boolean;
};

const shellClass =
  "pixel-font flex h-[68px] min-w-0 items-center gap-2 rounded-none border-4 px-2 py-2 text-left";

const palette = {
  human: "border-zinc-500 bg-zinc-800/90 text-white",
  open: "border-zinc-700 bg-zinc-950/80 text-zinc-500",
  bot: "border-cyan-500/70 bg-zinc-900 text-cyan-100",
  botInteractive:
    "touch-manipulation active:brightness-110 active:shadow-[inset_0_0_0_2px_rgba(255,255,255,0.2)]",
};

const tileContent = (slot: TeamSlotVisual) => {
  const titleClass =
    "truncate text-[10px] font-black tracking-[0.12em] uppercase";
  const subtitleClass =
    "text-[8px] font-semibold tracking-[0.14em] text-zinc-400 uppercase";

  if (slot.kind === "human") {
    return (
      <>
        <PlayerAvatar
          player={slot.player}
          size="sm"
          className="h-8 w-8 border-2 border-zinc-500"
        />
        <div className="min-w-0">
          <div className={cx(titleClass, "text-white")}>{slot.player.label}</div>
          <div className={subtitleClass}>Player</div>
        </div>
      </>
    );
  }

  if (slot.kind === "bot") {
    return (
      <>
        <PlayerAvatar
          player={BOT_AVATAR_PLAYER}
          isBot
          size="sm"
          className="h-8 w-8 border-2 border-cyan-500/60"
        />
        <div className="min-w-0">
          <div className={cx(titleClass, "text-cyan-50")}>Bot Slot</div>
          <div className={cx(subtitleClass, "text-cyan-200/80")}>
            Remove Bot
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-zinc-600 bg-zinc-900 text-[8px] font-black tracking-[0.12em] text-zinc-500 uppercase">
        --
      </div>
      <div className="min-w-0">
        <div className={cx(titleClass, "text-zinc-400")}>Open Slot</div>
        <div className={cx(subtitleClass, "text-zinc-600")}>
          Waiting On Phone
        </div>
      </div>
    </>
  );
};

export const TeamSlotTile = ({
  slot,
  testId,
  onBotAction,
  disabled = false,
}: TeamSlotTileProps) => {
  const shell = cx(
    shellClass,
    slot.kind === "human"
      ? palette.human
      : slot.kind === "bot"
        ? palette.bot
        : palette.open,
  );

  if (slot.kind === "bot" && onBotAction) {
    return (
      <button
        type="button"
        data-testid={testId}
        className={cx(shell, palette.botInteractive)}
        disabled={disabled}
        onClick={onBotAction}
      >
        {tileContent(slot)}
      </button>
    );
  }

  return (
    <div className={shell} data-testid={testId}>
      {tileContent(slot)}
    </div>
  );
};
