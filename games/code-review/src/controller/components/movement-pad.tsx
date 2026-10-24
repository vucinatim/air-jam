import { AxisButton } from "@air-jam/sdk/ui";
import { codeReviewInput } from "../../game/contracts/input";

const directions = [
  {
    label: "Move up",
    glyph: "↑",
    control: codeReviewInput.vertical,
    value: -1,
    cell: "col-start-2 row-start-1",
  },
  {
    label: "Move left",
    glyph: "←",
    control: codeReviewInput.horizontal,
    value: -1,
    cell: "col-start-1 row-start-2",
  },
  {
    label: "Move right",
    glyph: "→",
    control: codeReviewInput.horizontal,
    value: 1,
    cell: "col-start-3 row-start-2",
  },
  {
    label: "Move down",
    glyph: "↓",
    control: codeReviewInput.vertical,
    value: 1,
    cell: "col-start-2 row-start-3",
  },
] as const;

/** Directional buttons use local meaning, so viewport rotation cannot swap axes. */
export function MovementPad() {
  return (
    <div
      role="group"
      aria-label="Movement"
      className="grid aspect-square max-h-full w-full max-w-56 grid-cols-3 grid-rows-3 gap-1 self-center"
    >
      {directions.map(({ label, glyph, control, value, cell }) => (
        <AxisButton
          key={label}
          control={control}
          value={value}
          aria-label={label}
          className={`${cell} min-h-0 border-2 border-zinc-500 bg-zinc-800 text-xl text-white focus-visible:outline-2 focus-visible:outline-white active:bg-zinc-600 data-[active=true]:bg-zinc-600`}
        >
          <span aria-hidden="true" className="font-sans text-3xl font-bold">
            {glyph}
          </span>
        </AxisButton>
      ))}
    </div>
  );
}
