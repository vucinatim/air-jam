import { useCodeReviewControllerTeams } from "../hooks/use-code-review-controller-teams";
import { MovementPad } from "./movement-pad";

interface PlayingControlsProps {
  movementMode: "touch" | "tilt";
  motionStatus: "touch" | "requesting" | "tilt" | "denied" | "unavailable";
  onEnableTilt: () => Promise<void>;
  onUseTouch: () => void;
  onMove: (vector: { x: number; y: number }) => void;
  onLeftPunch: () => void;
  onRightPunch: () => void;
  onDefendStart: () => void;
  onDefendEnd: () => void;
}

export const PlayingControls = ({
  movementMode,
  motionStatus,
  onEnableTilt,
  onUseTouch,
  onMove,
  onLeftPunch,
  onRightPunch,
  onDefendStart,
  onDefendEnd,
}: PlayingControlsProps) => {
  const { teamAccent } = useCodeReviewControllerTeams();

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 bg-[linear-gradient(180deg,rgba(24,24,27,0.96)_0%,rgba(12,10,9,0.98)_100%)] p-3">
      <div className="flex shrink-0 items-center justify-between gap-2 text-[9px] leading-relaxed text-zinc-300">
        <span role="status">
          {motionStatus === "denied"
            ? "Motion denied. Touch controls are ready."
            : motionStatus === "unavailable"
              ? "Motion unavailable here. Use touch controls."
              : motionStatus === "requesting"
                ? "Waiting for motion permission…"
                : movementMode === "tilt"
                  ? "Tilt to move. Tap to punch."
                  : "Hold arrows to move. Tap to punch."}
        </span>
        <button
          type="button"
          className="shrink-0 border-2 border-zinc-500 bg-zinc-800 px-3 py-2 text-white"
          onClick={() => {
            if (movementMode === "tilt" || motionStatus === "requesting")
              onUseTouch();
            else void onEnableTilt();
          }}
        >
          {movementMode === "tilt" || motionStatus === "requesting"
            ? "Use touch"
            : "Enable tilt"}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 gap-3">
        {movementMode === "touch" ? (
          <div className="flex min-h-0 w-[30%] items-center justify-center">
            <MovementPad onMove={onMove} />
          </div>
        ) : null}
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-3 gap-2">
          <button
            type="button"
            className="flex min-h-0 min-w-0 touch-none flex-col items-start justify-between rounded-none border-4 px-2 py-3 text-left text-white shadow-[0_18px_40px_rgba(24,24,27,0.34)] select-none active:scale-[0.985]"
            style={{
              background: `linear-gradient(180deg, ${teamAccent}, color-mix(in srgb, ${teamAccent} 60%, #111827))`,
              borderColor: teamAccent,
              willChange: "transform",
              transition: "none",
            }}
            onPointerDown={onLeftPunch}
            onClick={(event) => {
              if (event.detail === 0) onLeftPunch();
            }}
          >
            <p className="text-[10px] tracking-[0.18em] text-white/75 uppercase">
              Tap
            </p>
            <p className="max-w-full text-base leading-tight sm:text-lg">
              Left
            </p>
          </button>

          <button
            type="button"
            className="flex min-h-0 min-w-0 touch-none flex-col items-start justify-between rounded-none border-4 px-2 py-3 text-left text-white shadow-[0_22px_50px_rgba(24,24,27,0.38)] select-none active:scale-[0.985]"
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
            onKeyDown={(event) => {
              if (
                (event.key === " " || event.key === "Enter") &&
                !event.repeat
              ) {
                event.preventDefault();
                onDefendStart();
              }
            }}
            onKeyUp={(event) => {
              if (event.key === " " || event.key === "Enter") onDefendEnd();
            }}
            onBlur={onDefendEnd}
          >
            <div>
              <p className="text-[10px] tracking-[0.18em] text-white/75 uppercase">
                Hold
              </p>
              <p className="mt-3 max-w-full text-base leading-tight sm:text-lg">
                Guard
              </p>
            </div>
            <p className="max-w-full text-[11px] leading-relaxed text-white/90">
              Block
            </p>
          </button>

          <button
            type="button"
            className="flex min-h-0 min-w-0 touch-none flex-col items-start justify-between rounded-none border-4 px-2 py-3 text-left text-white shadow-[0_18px_40px_rgba(24,24,27,0.34)] select-none active:scale-[0.985]"
            style={{
              background: `linear-gradient(180deg, ${teamAccent}, color-mix(in srgb, ${teamAccent} 66%, #0f172a))`,
              borderColor: teamAccent,
              willChange: "transform",
              transition: "none",
            }}
            onPointerDown={onRightPunch}
            onClick={(event) => {
              if (event.detail === 0) onRightPunch();
            }}
          >
            <p className="text-[10px] tracking-[0.18em] text-white/75 uppercase">
              Tap
            </p>
            <p className="max-w-full text-base leading-tight sm:text-lg">
              Right
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};
