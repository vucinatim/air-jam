import type { PlayerProfile } from "@air-jam/sdk/protocol";
import { PlayerAvatar } from "@air-jam/sdk/ui";

const listNames = (players: PlayerProfile[]) =>
  new Intl.ListFormat("en", { type: "conjunction" }).format(
    players.map((player) => player.label),
  );

interface WaitingOverlayProps {
  players: PlayerProfile[];
}

export const WaitingOverlay = ({ players }: WaitingOverlayProps) => (
  <div
    className="absolute inset-0 overflow-y-auto bg-[var(--airjam-color-controller-background)]/60 backdrop-blur-sm"
    data-testid="pong-host-waiting-overlay"
  >
    <div className="flex min-h-full items-center justify-center px-4 py-6">
      <div
        role="status"
        className="pong-panel-strong flex max-w-md flex-col items-center gap-4 rounded-[28px] px-6 py-7 text-center text-white"
      >
        <div className="flex -space-x-3">
          {players.map((player) => (
            <PlayerAvatar
              key={player.id}
              player={player}
              size="lg"
              className="opacity-60 grayscale"
            />
          ))}
        </div>
        <div className="pong-caption">Match on hold</div>
        <div className="text-2xl font-black tracking-[0.08em] text-balance text-white">
          Waiting for {listNames(players)}
        </div>
        <div className="pong-status-pill">
          <span className="size-2 rounded-full bg-amber-400 motion-safe:animate-pulse" />
          Reconnecting
        </div>
        <p className="max-w-xs text-sm leading-6 text-pretty text-slate-300">
          Play picks up with a fresh serve when they are back.
        </p>
      </div>
    </div>
  </div>
);
