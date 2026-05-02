import { useCodeReviewControllerTeams } from "../hooks/use-code-review-controller-teams";

interface PlayingControlsProps {
  onLeftPunch: () => void;
  onRightPunch: () => void;
  onDefendStart: () => void;
  onDefendEnd: () => void;
}

export const PlayingControls = ({
  onLeftPunch,
  onRightPunch,
  onDefendStart,
  onDefendEnd,
}: PlayingControlsProps) => {
  const { teamAccent } = useCodeReviewControllerTeams();

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-[linear-gradient(180deg,rgba(24,24,27,0.96)_0%,rgba(12,10,9,0.98)_100%)] p-3">
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-3">
        <button
          type="button"
          className="flex min-h-0 touch-none flex-col items-start justify-between rounded-none border-4 px-4 py-4 text-left text-white shadow-[0_18px_40px_rgba(24,24,27,0.34)] select-none active:scale-[0.985]"
          style={{
            background: `linear-gradient(180deg, ${teamAccent}, color-mix(in srgb, ${teamAccent} 60%, #111827))`,
            borderColor: teamAccent,
            willChange: "transform",
            transition: "none",
          }}
          onPointerDown={onLeftPunch}
        >
          <p className="text-[10px] tracking-[0.18em] text-white/75 uppercase">
            Tap
          </p>
          <p className="max-w-full text-[1.55rem] leading-[0.95] sm:text-[1.8rem]">
            Left
          </p>
        </button>

        <button
          type="button"
          className="flex min-h-0 touch-none flex-col items-start justify-between rounded-none border-4 px-4 py-4 text-left text-white shadow-[0_22px_50px_rgba(24,24,27,0.38)] select-none active:scale-[0.985]"
          style={{
            background: `linear-gradient(180deg, ${teamAccent}, color-mix(in srgb, ${teamAccent} 56%, #18181b))`,
            borderColor: teamAccent,
            willChange: "transform",
            transition: "none",
          }}
          onPointerDown={onDefendStart}
          onPointerUp={onDefendEnd}
          onPointerCancel={onDefendEnd}
          onPointerLeave={onDefendEnd}
        >
          <div>
            <p className="text-[10px] tracking-[0.18em] text-white/75 uppercase">
              Hold
            </p>
            <p className="mt-3 max-w-full text-[1.55rem] leading-[0.95] sm:text-[1.8rem]">
              Guard
            </p>
          </div>
          <p className="max-w-full text-[11px] leading-relaxed text-white/90">
            Block
          </p>
        </button>

        <button
          type="button"
          className="flex min-h-0 touch-none flex-col items-start justify-between rounded-none border-4 px-4 py-4 text-left text-white shadow-[0_18px_40px_rgba(24,24,27,0.34)] select-none active:scale-[0.985]"
          style={{
            background: `linear-gradient(180deg, ${teamAccent}, color-mix(in srgb, ${teamAccent} 66%, #0f172a))`,
            borderColor: teamAccent,
            willChange: "transform",
            transition: "none",
          }}
          onPointerDown={onRightPunch}
        >
          <p className="text-[10px] tracking-[0.18em] text-white/75 uppercase">
            Tap
          </p>
          <p className="max-w-full text-[1.55rem] leading-[0.95] sm:text-[1.8rem]">
            Right
          </p>
        </button>
      </div>
    </div>
  );
};
