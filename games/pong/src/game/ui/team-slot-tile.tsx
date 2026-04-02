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
  surface: "controller" | "host";
  onBotAction?: () => void;
  disabled?: boolean;
};

const shellClassBySurface = {
  controller:
    "flex h-[68px] min-w-0 items-center gap-2 rounded-[18px] border px-2 py-3 text-left",
  host: "flex h-[72px] items-center gap-3 rounded-[22px] border px-4",
} as const;

const paletteBySurface = {
  controller: {
    human: "border-white/16 bg-white/12 text-white",
    open: "border-white/10 bg-white/4 text-zinc-500",
    bot: "border-cyan-400/40 bg-cyan-400/12 text-cyan-100",
    botInteractive:
      "touch-manipulation active:brightness-110 active:shadow-[inset_0_0_0_2px_rgba(255,255,255,0.24)]",
  },
  host: {
    human: "border-white/14 bg-white/8 text-white",
    open: "border-white/10 bg-white/4 text-zinc-500",
    bot: "border-cyan-400/28 bg-cyan-400/10 text-cyan-100",
    botInteractive: "",
  },
} as const;

const avatarClassBySurface = {
  controller: "h-8 w-8 border-2",
  host: "h-10 w-10 border-2",
} as const;

const badgeClassBySurface = {
  controller:
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[9px] font-black tracking-[0.14em] uppercase",
  host: "flex h-10 w-10 items-center justify-center rounded-full border-2 text-[11px] font-black tracking-[0.14em] uppercase",
} as const;

const textClassBySurface = {
  controller: {
    title: "truncate text-[11px] font-black tracking-[0.14em] uppercase",
    subtitle: "text-[9px] font-semibold tracking-[0.16em] uppercase",
  },
  host: {
    title: "truncate text-sm font-black tracking-[0.14em] uppercase",
    subtitle: "text-[10px] font-semibold tracking-[0.16em] uppercase",
  },
} as const;

const tileContent = (slot: TeamSlotVisual, surface: "controller" | "host") => {
  const text = textClassBySurface[surface];

  if (slot.kind === "human") {
    return (
      <>
        <PlayerAvatar
          player={slot.player}
          size="sm"
          className={avatarClassBySurface[surface]}
        />
        <div className="min-w-0">
          <div className={cx(text.title, "text-white")}>{slot.player.label}</div>
          <div className={cx(text.subtitle, "text-zinc-400")}>Player</div>
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
          className={avatarClassBySurface[surface]}
        />
        <div className="min-w-0">
          <div className={cx(text.title, "text-cyan-50")}>Bot Slot</div>
          <div className={cx(text.subtitle, "text-cyan-200/72")}>
            {surface === "controller" ? "Remove Bot" : "Auto-Assigned"}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div
        className={cx(
          badgeClassBySurface[surface],
          "border-white/10 bg-white/6 text-zinc-500",
        )}
      >
        --
      </div>
      <div className="min-w-0">
        <div className={cx(text.title, "text-zinc-400")}>Open Slot</div>
        <div className={cx(text.subtitle, "text-zinc-600")}>
          Waiting On Phone
        </div>
      </div>
    </>
  );
};

export const TeamSlotTile = ({
  slot,
  testId,
  surface,
  onBotAction,
  disabled = false,
}: TeamSlotTileProps) => {
  const palette = paletteBySurface[surface];
  const shellClass = cx(
    shellClassBySurface[surface],
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
        className={cx(shellClass, palette.botInteractive)}
        disabled={disabled}
        onClick={onBotAction}
      >
        {tileContent(slot, surface)}
      </button>
    );
  }

  return (
    <div className={shellClass} data-testid={testId}>
      {tileContent(slot, surface)}
    </div>
  );
};
