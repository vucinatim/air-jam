import { PRESS_FEEL_CLASS } from "../constants";

interface PlayingControlsProps {
  controlsDisabled: boolean;
  onDirectionChange: (direction: -1 | 0 | 1) => void;
}

interface DirectionButtonProps {
  label: string;
  direction: -1 | 1;
  controlsDisabled: boolean;
  onDirectionChange: (direction: -1 | 0 | 1) => void;
}

const DirectionButton = ({
  label,
  direction,
  controlsDisabled,
  onDirectionChange,
}: DirectionButtonProps) => {
  return (
    <button
      type="button"
      className={`flex-1 touch-none rounded-xl bg-zinc-800 text-4xl font-bold text-white shadow-lg select-none hover:bg-zinc-700 active:bg-zinc-700 ${PRESS_FEEL_CLASS}`}
      disabled={controlsDisabled}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onDirectionChange(direction);
      }}
      onPointerUp={() => onDirectionChange(0)}
      onPointerCancel={() => onDirectionChange(0)}
      onPointerLeave={() => onDirectionChange(0)}
      onLostPointerCapture={() => onDirectionChange(0)}
    >
      {label}
    </button>
  );
};

export const PlayingControls = ({
  controlsDisabled,
  onDirectionChange,
}: PlayingControlsProps) => {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <DirectionButton
        label="▲ UP"
        direction={-1}
        controlsDisabled={controlsDisabled}
        onDirectionChange={onDirectionChange}
      />
      <DirectionButton
        label="▼ DOWN"
        direction={1}
        controlsDisabled={controlsDisabled}
        onDirectionChange={onDirectionChange}
      />
    </div>
  );
};
