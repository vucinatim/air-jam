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
  "flex min-h-[4.5rem] min-w-0 items-center gap-2.5 rounded-xl border px-3 py-3 text-left";

const palette = {
  human: "border-white/16 bg-white/12 text-white",
  open: "border-white/10 bg-white/4 text-zinc-500",
  bot: "border-cyan-400/40 bg-cyan-400/12 text-cyan-100",
  botInteractive:
    "touch-manipulation active:brightness-110 active:shadow-[inset_0_0_0_2px_rgba(255,255,255,0.24)]",
};

const tileContent = (slot: TeamSlotVisual) => {
  const titleClass =
    "truncate text-[0.6875rem] font-black tracking-[0.14em] uppercase";
  const subtitleClass =
    "text-[0.625rem] font-semibold tracking-[0.16em] uppercase";

  if (slot.kind === "human") {
    return (
      <>
        <PlayerAvatar
          player={slot.player}
          size="sm"
          className="h-10 w-10 border-2"
        />
        <div className="min-w-0">
          <div className={cx(titleClass, "text-white")}>{slot.player.label}</div>
          <div className={cx(subtitleClass, "text-zinc-400")}>Player</div>
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
          className="h-10 w-10 border-2"
        />
        <div className="min-w-0">
          <div className={cx(titleClass, "text-cyan-50")}>Bot Slot</div>
          <div className={cx(subtitleClass, "text-cyan-200/72")}>
            Remove Bot
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white/10 bg-white/6 text-[0.625rem] font-black tracking-[0.14em] text-zinc-500 uppercase">
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
